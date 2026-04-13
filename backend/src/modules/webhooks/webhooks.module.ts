import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSecretGuard } from './webhook-secret.guard';

@Module({
  providers: [WebhooksService, WebhookSecretGuard],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
