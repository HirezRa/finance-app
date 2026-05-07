import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { randomUUID } from 'crypto';
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
    const syncRunId = randomUUID();
    this.logger.log(`Processing sync job: ${job.id}`);
    const jobT0 = Date.now();
    const queueName = job.queue.name;
    const enqueueTs = job.timestamp ? new Date(job.timestamp).toISOString() : undefined;
    const dequeueTs = new Date().toISOString();
    const waitMs = job.timestamp ? Date.now() - job.timestamp : undefined;
    this.appLogs.add('DEBUG', 'sync', 'sync_job_received', {
      syncRunId,
      jobId: String(job.id),
      configId,
      userId,
      queue: {
        queueName,
        enqueueTs,
        dequeueTs,
        waitMs,
      },
    });

    try {
      const result = await this.scraperService.runScraper(
        configId,
        userId,
        String(job.id),
        syncRunId,
        {
          queueName,
          enqueueTs,
          dequeueTs,
          waitMs,
        },
      );

      this.logger.log(
        `Sync job ${job.id} completed: ${result.newTransactionsCount} new transactions`,
      );
      this.appLogs.add('INFO', 'sync', 'sync_job_completed', {
        syncRunId,
        jobId: String(job.id),
        configId,
        newTransactionsCount: result.newTransactionsCount,
        accountsSucceeded: result.updatedAccountsCount,
        accountsFailed: result.accountsFailed ?? 0,
        partialSync: Boolean(result.partialSync),
        durationMs: Date.now() - jobT0,
      });
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync job ${job.id} failed: ${message}`);
      this.appLogs.add(
        'ERROR',
        'sync',
        'sync_job_failed',
        {
          syncRunId,
          jobId: String(job.id),
          configId,
          durationMs: Date.now() - jobT0,
          errorMessage: shortenSyncErrorMessage(message),
          errorFull: message,
        },
      );
      throw error;
    }
  }
}
