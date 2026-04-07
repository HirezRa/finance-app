import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { N8nWebhookService } from './n8n-webhook.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsService, N8nWebhookService],
  exports: [AlertsService, N8nWebhookService],
})
export class AlertsModule {}
