import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { SyncController } from './sync.controller';

@Module({
  imports: [FilesModule],
  controllers: [SyncController],
})
export class SyncModule {}
