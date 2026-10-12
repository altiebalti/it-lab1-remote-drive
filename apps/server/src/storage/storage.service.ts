import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  private readonly presignClient: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET', 'drive');

    const region = config.get<string>('S3_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: config.get<string>('S3_ACCESS_KEY', 'minioadmin'),
      secretAccessKey: config.get<string>('S3_SECRET_KEY', 'minioadmin'),
    };

    const forcePathStyle =
      config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    const endpoint = config.get<string>('S3_ENDPOINT', 'http://localhost:9000');

    const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT', endpoint);

    this.client = new S3Client({ endpoint, region, credentials, forcePathStyle });
    this.presignClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({ endpoint: publicEndpoint, region, credentials, forcePathStyle });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
    await this.ensureCors();

    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const publicEndpoint = this.config.get<string>('S3_PUBLIC_ENDPOINT');
    this.logger.log(
      `Сховище: ${endpoint}, бакет «${this.bucket}»` +
        (publicEndpoint && publicEndpoint !== endpoint
          ? `, публічна адреса для посилань: ${publicEndpoint}`
          : ''),
    );
  }

  private async ensureCors(): Promise<void> {
    const origins = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.startsWith('http'));

    if (origins.length === 0) return;

    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: origins,
                AllowedMethods: ['GET', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['Content-Length', 'Content-Type'],
                MaxAgeSeconds: 3000,
              },
            ],
          },
        }),
      );
      this.logger.log(`Сховище дозволяє читання з: ${origins.join(', ')}`);
    } catch (error) {
      this.logger.warn(
        `Не вдалося налаштувати CORS на сховищі: ${String(error)}. ` +
          'Синхронізація у вебверсії може не читати файли.',
      );
    }
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Створено бакет «${this.bucket}»`);
      } catch (error) {
        this.logger.error(
          `Не вдалося створити бакет «${this.bucket}»: ${String(error)}`,
        );
      }
    }
  }

  static hash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await response.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async presignedDownloadUrl(
    key: string,
    fileName: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async presignedViewUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
