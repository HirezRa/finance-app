import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ScraperService } from './scraper.service';

@Processor('scraper')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(private readonly scraperService: ScraperService) {}

  @Process('sync-account')
  async handleSync(job: Job<{ configId: string; userId: string }>) {
    this.logger.log(`Processing sync job: ${job.id}`);

    try {
      const result = await this.scraperService.runScraper(
        job.data.configId,
        job.data.userId,
      );

      this.logger.log(
        `Sync job ${job.id} completed: ${result.newTransactionsCount} new transactions`,
      );
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync job ${job.id} failed: ${message}`);
      throw error;
    }
  }
}
