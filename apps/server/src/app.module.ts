import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { SyncModule } from './sync/sync.module';
import { FileEntity } from './files/file.entity';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env')],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {

        const url = config.get<string>('DATABASE_URL');

        return {
          type: 'postgres' as const,
          ...(url
            ? {
                url,

                ssl: { rejectUnauthorized: false },
              }
            : {
                host: config.get<string>('POSTGRES_HOST', 'localhost'),
                port: Number(config.get<string>('POSTGRES_PORT', '5432')),
                username: config.get<string>('POSTGRES_USER', 'drive'),
                password: config.get<string>('POSTGRES_PASSWORD', 'drive_dev_password'),
                database: config.get<string>('POSTGRES_DB', 'drive'),
              }),
          entities: [User, FileEntity],

          synchronize: config.get<string>('DB_SYNCHRONIZE', 'true') !== 'false',
        };
      },
    }),
    AuthModule,
    HealthModule,
    StorageModule,
    FilesModule,
    SyncModule,
  ],
})
export class AppModule {}
