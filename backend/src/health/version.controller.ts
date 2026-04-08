import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_VERSION } from '../version';

@Controller()
@SkipThrottle()
export class VersionController {
  @Get('version')
  getVersion(): {
    version: string;
    name: string;
    environment: string;
  } {
    return {
      version: APP_VERSION,
      name: 'Finance App',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
