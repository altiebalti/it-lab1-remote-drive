import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некоректна електронна пошта' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль має містити щонайменше 8 символів' })
  @MaxLength(72, { message: 'Пароль задовгий' })
  password: string;

  @IsString()
  @MinLength(1, { message: "Вкажіть ім'я" })
  @MaxLength(64)
  displayName: string;
}
