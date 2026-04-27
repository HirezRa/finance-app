import { Injectable } from '@nestjs/common';
import { LogsService } from '../../logs/logs.service';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMModel,
} from '../llm.types';

export type OllamaRuntimeConfig = {
  baseUrl: string;
  model: string;
};

@Injectable()
export class OllamaLlmProvider {
  constructor(private readonly appLogs: LogsService) {}

  async testConnection(cfg: OllamaRuntimeConfig): Promise<boolean> {
    try {
      const base = cfg.baseUrl.replace(/\/+$/, '');
      const response = await fetch(`${base}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'ollama', 'בדיקת חיבור Ollama נכשלה', {
        error: msg,
      });
      return false;
    }
  }

  async getAvailableModels(cfg: OllamaRuntimeConfig): Promise<LLMModel[]> {
    try {
      const base = cfg.baseUrl.replace(/\/+$/, '');
      const response = await fetch(`${base}/api/tags`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        models?: { name: string; details?: { context_length?: number } }[];
      };
      return (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        contextLength: m.details?.context_length,
      }));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'ollama', 'שליפת מודלים מ-Ollama נכשלה', {
        error: msg,
      });
      return [];
    }
  }

  async complete(
    cfg: OllamaRuntimeConfig,
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    const startTime = Date.now();
    const modelToUse = request.model || cfg.model;
    const base = cfg.baseUrl.replace(/\/+$/, '');

    const prompt = request.messages
      .map((m) =>
        m.role === 'system'
          ? m.content
          : m.role === 'user'
            ? `Human: ${m.content}`
            : `Assistant: ${m.content}`,
      )
      .join('\n\n');

    this.appLogs.add('DEBUG', 'ollama', 'שליחת בקשה ל-Ollama', {
      model: modelToUse,
      promptLength: prompt.length,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          prompt,
          stream: false,
          format: request.responseFormat === 'json' ? 'json' : undefined,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 1000,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = (await response.json()) as {
        response?: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const durationMs = Date.now() - startTime;

      this.appLogs.add('INFO', 'ollama', 'תשובה התקבלה מ-Ollama', {
        model: modelToUse,
        durationMs,
        responseLength: data.response?.length,
      });

      return {
        content: data.response ?? '',
        model: modelToUse,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens:
            (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: 'stop',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appLogs.add('ERROR', 'ollama', 'שגיאה בבקשת Ollama', {
        error: msg,
        model: modelToUse,
      });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
