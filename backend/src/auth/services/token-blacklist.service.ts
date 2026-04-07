import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private redis: Redis;
  private readonly PREFIX = 'blacklist:';
  private readonly USER_PREFIX = 'user_invalidated:';

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://redis:6379');
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async blacklist(token: string, expiresInSeconds: number): Promise<void> {
    const hash = this.hashToken(token);
    await this.redis.setex(this.PREFIX + hash, expiresInSeconds, '1');
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.redis.get(this.PREFIX + hash);
    return result !== null;
  }

  async invalidateAllUserTokens(userId: string): Promise<void> {
    await this.redis.set(this.USER_PREFIX + userId, Date.now().toString());
  }

  async getUserTokensInvalidatedAt(userId: string): Promise<number | null> {
    const timestamp = await this.redis.get(this.USER_PREFIX + userId);
    return timestamp ? parseInt(timestamp, 10) : null;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 32);
  }
}
