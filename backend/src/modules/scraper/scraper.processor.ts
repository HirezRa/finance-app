import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ScraperService } from './scraper.service';
import { LogsService } from '../logs/logs.service';
import { shortenSyncErrorMessage } from '../../common/utils/sync-error-message';

@Processor('scraper')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private readonly scraperService: ScraperService,
    private readonly appLogs: LogsService,
  ) {}

  @Process('sync-account')
  async handleSync(job: Job<{ configId: string; userId: string }>) {
    const { configId, userId } = job.data;
    this.logger.log(`Processing sync job: ${job.id}`);
    this.appLogs.add('DEBUG', 'sync', 'התקבלה משימת סנכרון', {
      jobId: String(job.id),
      configId,
      userId,
    });

    try {
      const result = await this.scraperService.runScraper(configId, userId);

      this.logger.log(
        `Sync job ${job.id} completed: ${result.newTransactionsCount} new transactions`,
      );
      this.appLogs.add('INFO', 'sync', 'משימת סנכרון הושלמה', {
        jobId: String(job.id),
        configId,
        newTransactionsCount: result.newTransactionsCount,
      });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync job ${job.id} failed: ${message}`);
      this.appLogs.add(
        'ERROR',
        'sync',
        `משימת סנכרון נכשלה: ${shortenSyncErrorMessage(message)}`,
        {
          jobId: String(job.id),
          configId,
          errorFull: message,
        },
      );
      throw error;
    }
  }
}
