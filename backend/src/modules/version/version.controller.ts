import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  VersionService,
  type GithubReleaseResponse,
  type SelfUpdateStatusDto,
} from './version.service';

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

  /** Background self-update (scripts/self-update.sh); requires SELF_UPDATE_ENABLED=true and mounts. */
  @Post('perform-update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  performSelfUpdate(): { success: boolean; messageHe: string } {
    return this.versionService.performSelfUpdate();
  }

  @Get('update-status')
  @UseGuards(JwtAuthGuard)
  getSelfUpdateStatus(): SelfUpdateStatusDto {
    return this.versionService.getSelfUpdateStatus();
  }
}
