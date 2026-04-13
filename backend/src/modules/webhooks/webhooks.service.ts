import { Injectable } from '@nestjs/common';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class WebhooksService {
  constructor(private readonly appLogs: LogsService) {}

  async processN8nTransaction(data: unknown): Promise<{
    processed: boolean;
    action: string;
  }> {
    const preview =
      data === null || data === undefined
        ? ''
        : JSON.stringify(data).slice(0, 400);
    this.appLogs.add('DEBUG', 'webhook', 'עיבוד גוף webhook עסקה (קטוע)', {
      preview: preview.length > 400 ? `${preview}…` : preview,
    });
    return { processed: true, action: 'logged' };
  }

  async processN8nInvoice(data: Record<string, unknown>): Promise<{
    matched: boolean;
    transactionId?: string;
  }> {
    this.appLogs.add('DEBUG', 'webhook', 'עיבוד חשבונית (שדות)', {
      vendor: typeof data.vendor === 'string' ? data.vendor : undefined,
      amount: data.amount,
      date: data.date,
      ocrConfidence: data.ocrConfidence,
    });
    return { matched: false };
  }
}
