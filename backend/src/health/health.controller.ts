import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { getVersion } from '../version';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  getHealth(): { status: string; version: string; ts: string } {
    return {
      status: 'ok',
      version: getVersion(),
      ts: new Date().toISOString(),
    };
  }
}
