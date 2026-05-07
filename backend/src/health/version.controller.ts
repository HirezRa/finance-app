import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { APP_VERSION, getIsraeliBankScrapersReleaseRef } from '../version';

@Controller()
@SkipThrottle()
export class VersionController {
  @Get('version')
  getVersion(): {
    version: string;
    coreVersion: string;
    scraperAddOn: string;
    name: string;
    environment: string;
  } {
    const core = APP_VERSION;
    return {
      version: core,
      coreVersion: core,
      scraperAddOn: getIsraeliBankScrapersReleaseRef(),
      name: 'Finance App',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
