import { IsIn, IsOptional } from 'class-validator';
import type { FileFilter, SortOrder } from '@drive/core';

export class ListFilesDto {

  @IsOptional()
  @IsIn(['createdAt', 'name', 'updatedAt'])
  sort?: 'createdAt' | 'name' | 'updatedAt' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: SortOrder = 'desc';

  @IsOptional()
  @IsIn(['all', 'variant'])
  filter?: FileFilter = 'all';
}
