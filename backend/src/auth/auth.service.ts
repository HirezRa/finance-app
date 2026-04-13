import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccountLockoutService } from './services/account-lockout.service';
import { LogsService } from '../modules/logs/logs.service';

function maskEmail(email: string): string {
  const e = email.trim();
  if (!e.includes('@')) return '***';
  return e.replace(/(.{2}).*(@.*)/, '$1***$2');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly lockout: AccountLockoutService,
    private readonly appLogs: LogsService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string; email: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
      },
    });
    return { userId: user.id, email: user.email };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const identifier = dto.email.toLowerCase();
    await this.lockout.checkLockout(identifier);

    const user = await this.prisma.user.findUnique({
      where: { email: identifier },
    });
    if (!user) {
      await this.lockout.recordFailedAttempt(identifier);
      this.appLogs.add('WARN', 'auth', 'התחברות נכשלה — משתמש לא נמצא', {
        email: maskEmail(identifier),
      });
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.lockout.recordFailedAttempt(identifier);
      this.appLogs.add('WARN', 'auth', 'התחברות נכשלה — סיסמה שגויה', {
        email: maskEmail(identifier),
      });
      throw new UnauthorizedException('invalid credentials');
    }

    await this.lockout.resetAttempts(identifier);
    this.appLogs.add('INFO', 'auth', 'התחברות מוצלחת', {
      email: maskEmail(user.email),
    });
    const payload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }
}
