import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHmac } from 'crypto';

export interface AlertPayload {
  type:
    | 'budget_exceeded'
    | 'budget_warning'
    | 'large_expense'
    | 'sync_complete'
    | 'sync_error';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class N8nWebhookService {
  private readonly logger = new Logger(N8nWebhookService.name);

  constructor(private prisma: PrismaService) {}

  async sendAlert(userId: string, payload: AlertPayload): Promise<boolean> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings?.n8nEnabled || !settings?.n8nWebhookUrl) {
      this.logger.debug('N8N webhook not enabled');
      return false;
    }

    try {
      const body = JSON.stringify({
        ...payload,
        userId,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (settings.n8nWebhookSecret) {
        const signature = createHmac('sha256', settings.n8nWebhookSecret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(settings.n8nWebhookUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        this.logger.log(`N8N webhook sent: ${payload.type}`);
        return true;
      }
      this.logger.warn(`N8N webhook failed: ${response.status}`);
      return false;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`N8N webhook error: ${msg}`);
      return false;
    }
  }

  async sendBudgetAlert(
    userId: string,
    categoryName: string,
    spent: number,
    budget: number,
    percentage: number,
  ) {
    const isExceeded = percentage >= 100;

    await this.sendAlert(userId, {
      type: isExceeded ? 'budget_exceeded' : 'budget_warning',
      severity: isExceeded ? 'error' : 'warning',
      title: isExceeded ? `חריגה מתקציב: ${categoryName}` : `אזהרת תקציב: ${categoryName}`,
      message: `הוצאת ₪${spent.toLocaleString()} מתוך ₪${budget.toLocaleString()} (${percentage}%)`,
      data: { categoryName, spent, budget, percentage },
      timestamp: new Date().toISOString(),
    });
  }

  async sendLargeExpenseAlert(userId: string, description: string, amount: number) {
    await this.sendAlert(userId, {
      type: 'large_expense',
      severity: 'info',
      title: 'הוצאה גדולה',
      message: `${description}: ₪${Math.abs(amount).toLocaleString()}`,
      data: { description, amount },
      timestamp: new Date().toISOString(),
    });
  }

  async sendSyncCompleteAlert(
    userId: string,
    accountName: string,
    newTransactions: number,
  ) {
    await this.sendAlert(userId, {
      type: 'sync_complete',
      severity: 'info',
      title: 'סנכרון הושלם',
      message: `${accountName}: ${newTransactions} עסקאות חדשות`,
      data: { accountName, newTransactions },
      timestamp: new Date().toISOString(),
    });
  }

  async sendSyncErrorAlert(userId: string, accountName: string, error: string) {
    await this.sendAlert(userId, {
      type: 'sync_error',
      severity: 'error',
      title: 'שגיאת סנכרון',
      message: `${accountName}: ${error}`,
      data: { accountName, error },
      timestamp: new Date().toISOString(),
    });
  }
}
