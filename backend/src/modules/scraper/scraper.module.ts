import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperService } from './scraper.service';
import { ScraperConfigService } from './scraper-config.service';
import { ScraperController } from './scraper.controller';
import { ScraperProcessor } from './scraper.processor';
import { ScraperUpdateService } from './scraper-update.service';
import { OllamaCategorizerService } from './ollama-categorizer.service';
import { EncryptionModule } from '../../common/encryption/encryption.module';
import { AuthModule } from '../../auth/auth.module';
import { AlertsModule } from '../alerts/alerts.module';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scraper',
    }),
    EncryptionModule,
    AuthModule,
    AlertsModule,
    LLMModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScraperConfigService,
    ScraperProcessor,
    ScraperUpdateService,
    OllamaCategorizerService,
  ],
  exports: [ScraperService, ScraperConfigService],
})
export class ScraperModule {}
