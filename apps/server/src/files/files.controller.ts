import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { FileRecord } from '@drive/core';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../users/user.entity';
import { ListFilesDto } from './dto/list-files.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { FilesService, PreviewResult } from './files.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query() query: ListFilesDto,
  ): Promise<FileRecord[]> {
    return this.files.list(user, query);
  }

  @Get('manifest')
  manifest(@CurrentUser() user: User) {
    return this.files.manifest(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ): Promise<FileRecord> {
    return this.files.upload(user, file, dto.path);
  }

  @Get(':id/preview')
  preview(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreviewResult> {
    return this.files.preview(user, id);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string }> {
    return { url: await this.files.downloadUrl(user, id) };
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameFileDto,
  ): Promise<FileRecord> {
    return this.files.rename(user, id, dto.path);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.files.remove(user, id);
  }
}
