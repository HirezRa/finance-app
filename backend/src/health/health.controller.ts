import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_VERSION } from '../version';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  getHealth(): { status: string; version: string; ts: string } {
    return {
      status: 'ok',
      version: APP_VERSION,
      ts: new Date().toISOString(),
    };
  }
}
