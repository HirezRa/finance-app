import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ScraperService } from './scraper.service';
import { ScraperConfigService } from './scraper-config.service';
import { ScraperUpdateService } from './scraper-update.service';
import { CreateScraperConfigDto } from './dto/create-scraper-config.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('scraper')
@UseGuards(JwtAuthGuard)
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly configService: ScraperConfigService,
    private readonly updateService: ScraperUpdateService,
    @InjectQueue('scraper') private readonly scraperQueue: Queue,
  ) {}

  @Get('institutions')
  getInstitutions() {
    return this.scraperService.getSupportedInstitutions();
  }

  @Get('configs')
  getConfigs(@CurrentUser('id') userId: string) {
    return this.configService.findAllByUser(userId);
  }

  @Post('configs')
  createConfig(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateScraperConfigDto,
  ) {
    return this.configService.create(userId, dto);
  }

  @Delete('configs/:id')
  deleteConfig(
    @CurrentUser('id') userId: string,
    @Param('id') configId: string,
  ) {
    return this.configService.delete(configId, userId);
  }

  @Post('sync/:configId')
  async syncAccount(
    @CurrentUser('id') userId: string,
    @Param('configId') configId: string,
  ) {
    const job = await this.scraperQueue.add(
      'sync-account',
      {
        configId,
        userId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        timeout: 5 * 60 * 1000,
      },
    );

    return {
      jobId: job.id,
      message: 'סנכרון הותחל',
    };
  }

  @Post('sync-all')
  async syncAll(@CurrentUser('id') userId: string) {
    const configs = await this.configService.findAllByUser(userId);
    const jobs: { configId: string; jobId: string | number }[] = [];

    for (const config of configs) {
      if (config.isActive && config.syncEnabled) {
        const job = await this.scraperQueue.add(
          'sync-account',
          {
            configId: config.id,
            userId,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            timeout: 5 * 60 * 1000,
          },
        );
        jobs.push({ configId: config.id, jobId: job.id });
      }
    }

    return {
      message: `${jobs.length} סנכרונים הותחלו`,
      jobs,
    };
  }

  @Get('version')
  async getVersion() {
    return this.updateService.getVersionInfo();
  }

  @Get('check-updates')
  async checkUpdates() {
    return this.updateService.checkForUpdates();
  }
}
