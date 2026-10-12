import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { computeSyncPlan, type SyncPlan } from '@drive/core';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesService } from '../files/files.service';
import { User } from '../users/user.entity';
import { SyncDiffDto } from './dto/sync-diff.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly files: FilesService) {}

  @Post('diff')
  async diff(
    @CurrentUser() user: User,
    @Body() dto: SyncDiffDto,
  ): Promise<SyncPlan> {
    const remote = await this.files.manifest(user);
    return computeSyncPlan(dto.local, remote, dto.index ?? []);
  }
}
