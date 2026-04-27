import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogsService } from '../../logs/logs.service';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMModel,
} from '../llm.types';

export type OpenRouterRuntimeConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

@Injectable()
export class OpenRouterLlmProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly appLogs: LogsService,
  ) {}

  private defaultBaseUrl(): string {
    return this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
  }

  private getHeaders(apiKey: string): Record<string, string> {
    const referer =
      this.configService.get<string>('OPENROUTER_HTTP_REFERER') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'https://finance-app.local';
    const title =
      this.configService.get<string>('OPENROUTER_APP_TITLE') || 'Finance App';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': referer,
      'X-Title': title,
    };
  }

  async testConnection(cfg: OpenRouterRuntimeConfig): Promise<boolean> {
    if (!cfg.apiKey) return false;
    const base = (cfg.baseUrl || this.defaultBaseUrl()).replace(/\/+$/, '');
    try {
      const response = await fetch(`${base}/models`, {
        method: 'GET',
        headers: this.getHeaders(cfg.apiKey),
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'openrouter', 'בדיקת חיבור OpenRouter נכשלה', {
        error: msg,
      });
      return false;
    }
  }

  async getAvailableModels(cfg: OpenRouterRuntimeConfig): Promise<LLMModel[]> {
    if (!cfg.apiKey) return [];
    const base = (cfg.baseUrl || this.defaultBaseUrl()).replace(/\/+$/, '');
    try {
      const response = await fetch(`${base}/models`, {
        method: 'GET',
        headers: this.getHeaders(cfg.apiKey),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          context_length?: number;
          pricing?: { prompt?: string; completion?: string };
        }>;
      };

      const popularPrefixes = [
        'anthropic/',
        'openai/',
        'google/',
        'meta-llama/',
        'mistralai/',
      ];

      return (data.data || [])
        .filter((m) => popularPrefixes.some((p) => m.id.startsWith(p)))
        .slice(0, 50)
        .map((m) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length,
          pricing: m.pricing
            ? {
                prompt: m.pricing.prompt ?? '0',
                completion: m.pricing.completion ?? '0',
              }
            : undefined,
        }));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'openrouter', 'שליפת מודלים מ-OpenRouter נכשלה', {
        error: msg,
      });
      return [];
    }
  }

  async complete(
    cfg: OpenRouterRuntimeConfig,
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    const modelToUse = request.model || cfg.model;
    const base = (cfg.baseUrl || this.defaultBaseUrl()).replace(/\/+$/, '');

    if (!cfg.apiKey) {
      throw new Error('OpenRouter API key is not configured');
    }

    try {
      this.appLogs.add('DEBUG', 'openrouter', 'שליחת בקשה ל-OpenRouter', {
        model: modelToUse,
        messagesCount: request.messages.length,
      });

      const body: Record<string, unknown> = {
        model: modelToUse,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: request.maxTokens ?? 1000,
        temperature: request.temperature ?? 0.7,
      };

      if (request.responseFormat === 'json') {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(cfg.apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let message = `OpenRouter returned ${response.status}`;
        try {
          const errJson = JSON.parse(errText) as {
            error?: { message?: string };
          };
          if (errJson.error?.message) message = errJson.error.message;
        } catch {
          if (errText) message = errText.slice(0, 500);
        }
        throw new Error(message);
      }

      const data = (await response.json()) as {
        model?: string;
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const durationMs = Date.now() - startTime;

      this.appLogs.add('INFO', 'openrouter', 'תשובה התקבלה מ-OpenRouter', {
        model: modelToUse,
        durationMs,
        usage: data.usage,
      });

      const choice = data.choices?.[0];

      return {
        content: choice?.message?.content || '',
        model: data.model || modelToUse,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens || 0,
              completionTokens: data.usage.completion_tokens || 0,
              totalTokens: data.usage.total_tokens || 0,
            }
          : undefined,
        finishReason: choice?.finish_reason,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'openrouter', 'שגיאה בבקשת OpenRouter', {
        error: msg,
        model: modelToUse,
      });
      throw error;
    }
  }
}
