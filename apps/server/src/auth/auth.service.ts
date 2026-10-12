import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.users.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Користувач з такою поштою вже існує');
    }

    const user = this.users.create({
      email,
      displayName: dto.displayName.trim(),
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    });
    await this.users.save(user);

    return this.buildResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.users.findOne({
      where: { email },
      select: ['id', 'email', 'displayName', 'createdAt', 'passwordHash'],
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Невірна пошта або пароль');
    }

    return this.buildResult(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  private buildResult(user: User): AuthResult {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user: AuthService.toPublic(user),
    };
  }

  static toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
