import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  getHealth(): { status: string; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
