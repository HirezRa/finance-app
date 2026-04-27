import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { OllamaLlmProvider } from './providers/ollama.provider';
import { OpenRouterLlmProvider } from './providers/openrouter.provider';
import { LogsModule } from '../logs/logs.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionModule } from '../../common/encryption/encryption.module';

@Module({
  imports: [LogsModule, PrismaModule, EncryptionModule],
  controllers: [LLMController],
  providers: [LLMService, OllamaLlmProvider, OpenRouterLlmProvider],
  exports: [LLMService],
})
export class LLMModule {}
