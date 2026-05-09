import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { getIsraeliBankScrapersReleaseRef, getVersion } from '../version';

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
    const core = getVersion();
    return {
      version: core,
      coreVersion: core,
      scraperAddOn: getIsraeliBankScrapersReleaseRef(),
      name: 'Finance App',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}
