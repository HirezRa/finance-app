import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VersionService, type GithubReleaseResponse } from './version.service';

@Controller('version')
@SkipThrottle()
export class VersionGithubController {
  constructor(private readonly versionService: VersionService) {}

  /**
   * Latest GitHub release (user token in settings or GITHUB_TOKEN env).
   */
  @Get('github-release')
  @UseGuards(JwtAuthGuard)
  getGithubRelease(
    @CurrentUser('id') userId: string,
  ): Promise<GithubReleaseResponse> {
    return this.versionService.getLatestGithubRelease(userId);
  }
}
