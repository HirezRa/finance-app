import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LLMService } from './llm.service';
import type { LLMEngineId } from './llm.types';

@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LLMController {
  constructor(private readonly llmService: LLMService) {}

  @Get('status')
  async getStatus(@CurrentUser('id') userId: string) {
    return this.llmService.getStatusForUser(userId);
  }

  @Post('test/:provider')
  async testProvider(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
    @Body()
    body?: { apiKey?: string; url?: string; model?: string },
  ) {
    const p = provider as LLMEngineId;
    if (p !== 'ollama' && p !== 'openrouter') {
      return { provider, connected: false };
    }
    const connected = await this.llmService.testProviderForUser(
      userId,
      p,
      body,
    );
    return { provider: p, connected };
  }

  @Get('models/:provider')
  async getModels(
    @CurrentUser('id') userId: string,
    @Param('provider') provider: string,
  ) {
    const p = provider as LLMEngineId;
    if (p !== 'ollama' && p !== 'openrouter') {
      return { provider, models: [] };
    }
    const models = await this.llmService.listModelsForUser(userId, p);
    return { provider: p, models };
  }
}
