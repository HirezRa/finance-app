import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { LogsService } from '../logs/logs.service';
import { WebhookSecretGuard } from './webhook-secret.guard';

@Controller('webhooks')
@SkipThrottle()
@UseGuards(WebhookSecretGuard)
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly appLogs: LogsService,
  ) {}

  @Post('n8n/transaction')
  async receiveTransactionFromN8n(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const wf = headers['x-n8n-workflow-id'];
    const ex = headers['x-n8n-execution-id'];
    this.appLogs.add('INFO', 'webhook', 'Webhook n8n — עסקה', {
      type: 'transaction',
      hasBody: body != null && typeof body === 'object',
      bodyKeys:
        body && typeof body === 'object' && !Array.isArray(body)
          ? Object.keys(body as object)
          : [],
      n8nWorkflow: Array.isArray(wf) ? wf[0] : wf,
      n8nExecution: Array.isArray(ex) ? ex[0] : ex,
    });

    try {
      const result = await this.webhooksService.processN8nTransaction(body);
      this.appLogs.add('INFO', 'webhook', 'Webhook n8n — עסקה הושלמה', {
        type: 'transaction',
        result,
      });
      return { success: true, ...result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'webhook', 'Webhook n8n — שגיאה בעסקה', {
        type: 'transaction',
        error: message,
      });
      return { success: false, error: message };
    }
  }

  @Post('n8n/invoice')
  async receiveInvoiceFromN8n(
    @Body() body: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const wf = headers['x-n8n-workflow-id'];
    this.appLogs.add('INFO', 'webhook', 'Webhook n8n — חשבונית', {
      type: 'invoice',
      vendor: body?.vendor,
      amount: body?.amount,
      date: body?.date,
      n8nWorkflow: Array.isArray(wf) ? wf[0] : wf,
    });

    try {
      const result = await this.webhooksService.processN8nInvoice(
        body ?? {},
      );
      this.appLogs.add('INFO', 'webhook', 'Webhook n8n — חשבונית עובדה', {
        vendor: body?.vendor,
        matched: result.matched,
        transactionId: result.transactionId,
      });
      return { success: true, ...result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'webhook', 'Webhook n8n — שגיאה בחשבונית', {
        error: message,
        vendor: body?.vendor,
      });
      return { success: false, error: message };
    }
  }

  @Get('n8n/health')
  healthCheck() {
    this.appLogs.add('DEBUG', 'webhook', 'בדיקת תקינות n8n (GET)', {});
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'finance-app',
    };
  }
}
