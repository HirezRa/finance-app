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
  type PerformSelfUpdateResult,
  type SelfUpdateStatusDto,
  type UpdateStatus,
  type UpdateHistoryEntry,
} from './version.service';

@Controller('version')
@SkipThrottle()
export class VersionGithubController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  async getCurrentVersion() {
    return this.versionService.getCurrentVersion();
  }

  @Get('check-update')
  @UseGuards(JwtAuthGuard)
  async checkForUpdate() {
    return this.versionService.checkForUpdate();
  }

  @Post('trigger-update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async triggerUpdate() {
    return this.versionService.triggerUpdate();
  }

  @Get('update-status')
  @UseGuards(JwtAuthGuard)
  getUpdateStatus(): Promise<UpdateStatus> {
    return this.versionService.getUpdateStatus();
  }

  @Post('cancel-update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async cancelUpdate() {
    return this.versionService.cancelUpdate();
  }

  @Get('update-history')
  @UseGuards(JwtAuthGuard)
  getUpdateHistory(): Promise<UpdateHistoryEntry[]> {
    return this.versionService.getUpdateHistory();
  }

  // Backward compatibility
  @Get('github-release')
  @UseGuards(JwtAuthGuard)
  getGithubRelease(
    @CurrentUser('id') userId: string,
  ): Promise<GithubReleaseResponse> {
    return this.versionService.getLatestGithubRelease(userId);
  }

  @Post('perform-update')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  performSelfUpdate(): Promise<PerformSelfUpdateResult> {
    return this.versionService.performSelfUpdate();
  }

  @Get('self-update-status')
  @UseGuards(JwtAuthGuard)
  getSelfUpdateStatus(): SelfUpdateStatusDto {
    return this.versionService.getSelfUpdateStatus();
  }
}
