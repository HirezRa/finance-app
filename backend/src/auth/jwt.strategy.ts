import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBlacklistService } from './services/token-blacklist.service';

export type JwtUser = { userId: string; email: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly blacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: FastifyRequest,
    payload: { sub: string; email: string; iat?: number },
  ): Promise<JwtUser> {
    const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    const token = extractor(req);
    if (token && (await this.blacklist.isBlacklisted(token))) {
      throw new UnauthorizedException();
    }

    const invalidatedAt = await this.blacklist.getUserTokensInvalidatedAt(
      payload.sub,
    );
    if (
      invalidatedAt !== null &&
      payload.iat !== undefined &&
      payload.iat * 1000 < invalidatedAt
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, email: user.email };
  }
}
