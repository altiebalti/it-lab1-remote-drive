import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class LocalFileStateDto {
  @IsString()
  path: string;

  @IsString()
  contentHash: string;
}

export class SyncIndexEntryDto {
  @IsString()
  path: string;

  @IsString()
  contentHash: string;

  @IsString()
  remoteId: string;
}

export class SyncDiffDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalFileStateDto)
  local: LocalFileStateDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncIndexEntryDto)
  index?: SyncIndexEntryDto[];
}
