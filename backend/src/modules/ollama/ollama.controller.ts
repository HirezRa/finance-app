import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OllamaService } from './ollama.service';
import { OllamaCategorizeDto } from './dto/ollama-categorize.dto';
import { OllamaApplyDto } from './dto/ollama-apply.dto';
import { OllamaTestCategorizeDto } from './dto/ollama-test-categorize.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LogsService } from '../logs/logs.service';

@Controller('ollama')
@UseGuards(JwtAuthGuard)
export class OllamaController {
  constructor(
    private readonly ollamaService: OllamaService,
    private readonly appLogs: LogsService,
  ) {}

  @Get('status')
  async getOllamaStatus(@CurrentUser('id') userId: string) {
    const status = await this.ollamaService.getOllamaConnectionStatus(userId);
    this.appLogs.add('DEBUG', 'ollama', 'בקשת סטטוס Ollama מהממשק', {
      enabled: status.enabled,
      reachable: status.reachable,
      modelListed: status.modelListed,
    });
    return status;
  }

  @Post('test-connection')
  async testOllamaConnection(@CurrentUser('id') userId: string) {
    return this.ollamaService.testOllamaConnection(userId);
  }

  @Post('test-categorize')
  async testOllamaCategorize(
    @CurrentUser('id') userId: string,
    @Body() body: OllamaTestCategorizeDto,
  ) {
    const result = await this.ollamaService.testOllamaCategorize(
      userId,
      body.description,
      body.amount,
      body.categories,
    );
    if ('error' in result) {
      return { success: false, error: result.error };
    }
    return { success: true, suggestion: result };
  }

  @Get('count-uncategorized')
  async countUncategorized(@CurrentUser('id') userId: string) {
    return this.ollamaService.countUncategorized(userId);
  }

  @Get('uncategorized')
  async getUncategorized(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    const safe = Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
    const ids = await this.ollamaService.getUncategorizedTransactions(
      userId,
      safe,
    );
    return { count: ids.length, transactionIds: ids };
  }

  @Get('debug-uncategorized')
  async debugUncategorized(@CurrentUser('id') userId: string) {
    return this.ollamaService.debugUncategorized(userId);
  }

  @Get('for-improvement')
  async getForImprovement(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    const safe = Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
    const ids = await this.ollamaService.getTransactionsForImprovement(
      userId,
      safe,
    );
    return { count: ids.length, transactionIds: ids };
  }

  @Post('categorize')
  async categorize(
    @CurrentUser('id') userId: string,
    @Body() body: OllamaCategorizeDto,
  ) {
    const suggestions = await this.ollamaService.categorizeTransactions(
      userId,
      body.transactionIds,
      body.mode,
    );
    return { suggestions };
  }

  @Post('apply')
  async applySuggestions(
    @CurrentUser('id') userId: string,
    @Body() body: OllamaApplyDto,
  ) {
    const updated = await this.ollamaService.applySuggestions(
      userId,
      body.suggestions,
    );
    return { updated };
  }
}
