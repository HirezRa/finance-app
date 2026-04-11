import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { VersionService, type GithubReleaseResponse } from './version.service';

@Controller('version')
@SkipThrottle()
export class VersionGithubController {
  constructor(private readonly versionService: VersionService) {}

  /**
   * Latest GitHub release (supports private repo when GITHUB_TOKEN is set on server).
   */
  @Get('github-release')
  @UseGuards(JwtAuthGuard)
  getGithubRelease(): Promise<GithubReleaseResponse> {
    return this.versionService.getLatestGithubRelease();
  }
}
