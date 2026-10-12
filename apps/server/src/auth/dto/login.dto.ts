import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некоректна електронна пошта' })
  email: string;

  @IsString()
  password: string;
}
