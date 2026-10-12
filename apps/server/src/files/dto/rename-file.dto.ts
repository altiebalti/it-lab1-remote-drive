import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameFileDto {

  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  path: string;
}
