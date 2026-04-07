import {
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AccountLockoutService implements OnModuleDestroy {
  private redis: Redis;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 900;
  private readonly ATTEMPT_WINDOW = 900;

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL', 'redis://redis:6379');
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async checkLockout(identifier: string): Promise<void> {
    const lockKey = `lockout:${identifier}`;
    const ttl = await this.redis.ttl(lockKey);

    if (ttl > 0) {
      const minutes = Math.ceil(ttl / 60);
      throw new UnauthorizedException(
        `החשבון נעול. נסה שוב בעוד ${minutes} דקות`,
      );
    }
  }

  async recordFailedAttempt(
    identifier: string,
  ): Promise<{ locked: boolean; attemptsRemaining: number }> {
    const attemptsKey = `attempts:${identifier}`;
    const lockKey = `lockout:${identifier}`;

    const attempts = await this.redis.incr(attemptsKey);

    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.ATTEMPT_WINDOW);
    }

    if (attempts >= this.MAX_ATTEMPTS) {
      await this.redis.setex(lockKey, this.LOCKOUT_DURATION, '1');
      await this.redis.del(attemptsKey);
      return { locked: true, attemptsRemaining: 0 };
    }

    return { locked: false, attemptsRemaining: this.MAX_ATTEMPTS - attempts };
  }

  async resetAttempts(identifier: string): Promise<void> {
    await this.redis.del(`attempts:${identifier}`);
  }
}
