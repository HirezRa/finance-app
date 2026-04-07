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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly lockout: AccountLockoutService,
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
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.lockout.recordFailedAttempt(identifier);
      throw new UnauthorizedException('invalid credentials');
    }

    await this.lockout.resetAttempts(identifier);
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
