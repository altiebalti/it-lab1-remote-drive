import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  path?: string;
}
