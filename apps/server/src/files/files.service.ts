import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvalidPathError,
  PREVIEW_IMAGE_EXTENSIONS,
  VARIANT_FILTER_EXTENSIONS,
  baseName,
  detectPreviewKind,
  extensionOf,
  normalizeRelativePath,
  resolveMimeType,
  type FileRecord,
  type PreviewKind,
} from '@drive/core';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/user.entity';
import { FileEntity } from './file.entity';
import { ListFilesDto } from './dto/list-files.dto';

export interface PreviewResult {
  kind: PreviewKind;

  content?: string;

  url?: string;

  message?: string;
}

const MAX_TEXT_PREVIEW_BYTES = 512 * 1024;

@Injectable()
export class FilesService {
  private readonly maxUploadBytes: number;

  constructor(
    @InjectRepository(FileEntity)
    private readonly files: Repository<FileEntity>,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxUploadBytes =
      Number(config.get<string>('MAX_UPLOAD_MB', '50')) * 1024 * 1024;
  }

  async list(owner: User, query: ListFilesDto): Promise<FileRecord[]> {
    const order = query.order ?? 'desc';
    const filter = query.filter ?? 'all';
    const sort = query.sort ?? 'createdAt';

    const qb = this.files
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.uploadedBy', 'uploadedBy')
      .leftJoinAndSelect('file.editedBy', 'editedBy')
      .where('file.ownerId = :ownerId', { ownerId: owner.id });

    if (filter === 'variant') {
      qb.andWhere('file.ext IN (:...exts)', {
        exts: [...VARIANT_FILTER_EXTENSIONS],
      });
    }

    const direction = order === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(`file.${sort}`, direction);

    qb.addOrderBy('file.name', 'ASC');

    const rows = await qb.getMany();
    return rows.map((row) => FilesService.toRecord(row));
  }

  async upload(
    owner: User,
    file: Express.Multer.File,
    requestedPath?: string,
  ): Promise<FileRecord> {
    if (!file) {
      throw new BadRequestException('Файл не передано');
    }
    if (file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException(
        `Файл завеликий. Максимум ${Math.round(this.maxUploadBytes / 1024 / 1024)} МБ`,
      );
    }

    const fallbackName = Buffer.from(file.originalname, 'latin1').toString(
      'utf8',
    );
    const path = this.normalize(requestedPath ?? fallbackName);

    const existing = await this.files.findOne({
      where: { ownerId: owner.id, path },
    });
    if (existing) {

      return this.replaceContent(existing, owner, file);
    }

    const mimeType = resolveMimeType(path, file.mimetype);
    const storageKey = `${owner.id}/${path}`;
    await this.storage.put(storageKey, file.buffer, mimeType);

    const entity = this.files.create({
      ownerId: owner.id,
      path,
      name: baseName(path),
      ext: extensionOf(path),
      size: String(file.size),
      mimeType,
      storageKey,
      contentHash: StorageService.hash(file.buffer),
      uploadedById: owner.id,
      editedById: null,
    });
    await this.files.save(entity);

    return this.findRecord(owner, entity.id);
  }

  private async replaceContent(
    entity: FileEntity,
    editor: User,
    file: Express.Multer.File,
  ): Promise<FileRecord> {
    const mimeType = resolveMimeType(entity.path, file.mimetype);
    await this.storage.put(entity.storageKey, file.buffer, mimeType);

    entity.size = String(file.size);
    entity.mimeType = mimeType;
    entity.contentHash = StorageService.hash(file.buffer);
    entity.editedById = editor.id;
    await this.files.save(entity);

    return this.findRecord(editor, entity.id);
  }

  async rename(owner: User, id: string, newPath: string): Promise<FileRecord> {
    const entity = await this.findEntity(owner, id);
    const path = this.normalize(newPath);

    if (path === entity.path) {
      return FilesService.toRecord(entity);
    }

    const clash = await this.files.findOne({
      where: { ownerId: owner.id, path },
    });
    if (clash) {
      throw new ConflictException(`Файл «${path}» вже існує`);
    }

    const newKey = `${owner.id}/${path}`;
    const content = await this.storage.get(entity.storageKey);
    await this.storage.put(newKey, content, entity.mimeType);
    await this.storage.delete(entity.storageKey);

    entity.path = path;
    entity.name = baseName(path);
    entity.ext = extensionOf(path);
    entity.mimeType = resolveMimeType(path, undefined);
    entity.storageKey = newKey;
    entity.editedById = owner.id;
    await this.files.save(entity);

    return this.findRecord(owner, entity.id);
  }

  async remove(owner: User, id: string): Promise<void> {
    const entity = await this.findEntity(owner, id);
    await this.storage.delete(entity.storageKey);
    await this.files.remove(entity);
  }

  async downloadUrl(owner: User, id: string): Promise<string> {
    const entity = await this.findEntity(owner, id);
    return this.storage.presignedDownloadUrl(entity.storageKey, entity.name);
  }

  async preview(owner: User, id: string): Promise<PreviewResult> {
    const entity = await this.findEntity(owner, id);
    const kind = detectPreviewKind(entity.name);

    if (kind === 'text') {
      const size = Number(entity.size);
      if (size > MAX_TEXT_PREVIEW_BYTES) {
        return {
          kind: 'unsupported',
          message: 'Файл завеликий для перегляду в застосунку',
        };
      }
      const content = await this.storage.get(entity.storageKey);
      return { kind, content: content.toString('utf8') };
    }

    if (kind === 'image') {
      return { kind, url: await this.storage.presignedViewUrl(entity.storageKey) };
    }

    return {
      kind: 'unsupported',
      message: `Перегляд для «${entity.ext || 'без розширення'}» не підтримується. Доступні: ${[
        ...PREVIEW_IMAGE_EXTENSIONS,
        '.cs',
        '.xml',
      ].join(', ')}`,
    };
  }

  async manifest(owner: User): Promise<
    Array<{ id: string; path: string; contentHash: string }>
  > {
    const rows = await this.files.find({
      where: { ownerId: owner.id },
      select: ['id', 'path', 'contentHash'],
      order: { path: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      path: r.path,
      contentHash: r.contentHash,
    }));
  }

  async findEntity(owner: User, id: string): Promise<FileEntity> {
    const entity = await this.files.findOne({
      where: { id, ownerId: owner.id },
    });

    if (!entity) {
      throw new NotFoundException('Файл не знайдено');
    }
    return entity;
  }

  private async findRecord(owner: User, id: string): Promise<FileRecord> {
    return FilesService.toRecord(await this.findEntity(owner, id));
  }

  private normalize(raw: string): string {
    try {
      return normalizeRelativePath(raw);
    } catch (error) {
      if (error instanceof InvalidPathError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  static toRecord(entity: FileEntity): FileRecord {
    return {
      id: entity.id,
      path: entity.path,
      name: entity.name,
      ext: entity.ext,
      size: Number(entity.size),
      mimeType: entity.mimeType,
      contentHash: entity.contentHash,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      uploadedBy: {
        id: entity.uploadedBy.id,
        email: entity.uploadedBy.email,
        displayName: entity.uploadedBy.displayName,
      },
      editedBy: entity.editedBy
        ? {
            id: entity.editedBy.id,
            email: entity.editedBy.email,
            displayName: entity.editedBy.displayName,
          }
        : null,
    };
  }
}
