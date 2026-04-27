import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { LogsService } from '../logs/logs.service';
import { OllamaLlmProvider } from './providers/ollama.provider';
import { OpenRouterLlmProvider } from './providers/openrouter.provider';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMEngineId,
  LLMModel,
  LLMProviderStatus,
  LLMProviderType,
} from './llm.types';

const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';
const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';

@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly appLogs: LogsService,
    private readonly ollamaLlm: OllamaLlmProvider,
    private readonly openrouterLlm: OpenRouterLlmProvider,
  ) {}

  onModuleInit(): void {
    const envProvider = this.configService.get<string>('LLM_PROVIDER', 'ollama');
    this.appLogs.add('INFO', 'system', 'ברירת מחדל LLM מהסביבה', {
      LLM_PROVIDER: envProvider,
    });
  }

  effectiveProviderFromSettings(llmProvider: string | null | undefined): LLMProviderType {
    const v = llmProvider?.trim();
    if (v === 'none') return 'none';
    if (v === 'openrouter') return 'openrouter';
    return 'ollama';
  }

  async isAiConfiguredForUser(userId: string): Promise<boolean> {
    const s = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!s) return false;
    const p = this.effectiveProviderFromSettings(s.llmProvider);
    if (p === 'none') return false;
    if (p === 'openrouter') {
      return Boolean(
        s.openrouterApiKeyEncrypted &&
          s.openrouterApiKeyIv &&
          s.openrouterApiKeyTag,
      );
    }
    const url =
      s.ollamaUrl?.trim() ||
      this.configService.get<string>('OLLAMA_BASE_URL')?.trim() ||
      this.configService.get<string>('OLLAMA_URL')?.trim();
    return Boolean(s.ollamaEnabled && url);
  }

  private async decryptOpenrouterKey(userId: string): Promise<string | null> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: {
        openrouterApiKeyEncrypted: true,
        openrouterApiKeyIv: true,
        openrouterApiKeyTag: true,
      },
    });
    if (
      !row?.openrouterApiKeyEncrypted ||
      !row.openrouterApiKeyIv ||
      !row.openrouterApiKeyTag
    ) {
      return null;
    }
    try {
      return this.encryption.decrypt(
        row.openrouterApiKeyEncrypted,
        row.openrouterApiKeyIv,
        row.openrouterApiKeyTag,
      );
    } catch (e) {
      this.logger.error('Failed to decrypt OpenRouter key', e);
      return null;
    }
  }

  async completeForUser(
    userId: string,
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    const s = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!s) {
      throw new BadRequestException('הגדרות משתמש לא נמצאו');
    }

    const p = this.effectiveProviderFromSettings(s.llmProvider);
    if (p === 'none') {
      throw new BadRequestException('מנוע AI כבוי');
    }

    const configured = await this.isAiConfiguredForUser(userId);
    if (!configured) {
      throw new BadRequestException('מנוע AI אינו מוגדר או אינו פעיל');
    }

    if (p === 'openrouter') {
      const apiKey = await this.decryptOpenrouterKey(userId);
      if (!apiKey?.trim()) {
        throw new BadRequestException('חסר מפתח OpenRouter');
      }
      const baseUrl =
        this.configService.get<string>('OPENROUTER_BASE_URL') ||
        'https://openrouter.ai/api/v1';
      const model =
        s.openrouterModel?.trim() ||
        this.configService.get<string>('OPENROUTER_MODEL') ||
        DEFAULT_OPENROUTER_MODEL;
      return this.openrouterLlm.complete(
        { baseUrl, apiKey: apiKey.trim(), model },
        request,
      );
    }

    const baseUrl =
      s.ollamaUrl?.trim() ||
      this.configService.get<string>('OLLAMA_BASE_URL')?.trim() ||
      this.configService.get<string>('OLLAMA_URL')?.trim() ||
      '';
    if (!baseUrl) {
      throw new BadRequestException('חסרה כתובת שרת Ollama');
    }
    const model =
      s.ollamaModel?.trim() ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      DEFAULT_OLLAMA_MODEL;

    return this.ollamaLlm.complete({ baseUrl, model }, request);
  }

  async getStatusForUser(userId: string): Promise<{
    activeProvider: LLMProviderType;
    providers: Record<LLMEngineId, LLMProviderStatus>;
  }> {
    let s = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!s) {
      s = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    const inactive = (engine: LLMEngineId): LLMProviderStatus => ({
      provider: engine,
      enabled: false,
      connected: false,
      model: '',
      availableModels: [],
      error: undefined,
    });

    const active = this.effectiveProviderFromSettings(s.llmProvider);

    if (active === 'none') {
      return {
        activeProvider: 'none',
        providers: {
          ollama: inactive('ollama'),
          openrouter: inactive('openrouter'),
        },
      };
    }

    const ollamaUrl =
      s.ollamaUrl?.trim() ||
      this.configService.get<string>('OLLAMA_BASE_URL')?.trim() ||
      this.configService.get<string>('OLLAMA_URL')?.trim() ||
      '';
    const ollamaModel =
      s.ollamaModel?.trim() ||
      this.configService.get<string>('OLLAMA_MODEL') ||
      DEFAULT_OLLAMA_MODEL;

    const openrouterKey = await this.decryptOpenrouterKey(userId);
    const openrouterModel =
      s.openrouterModel?.trim() ||
      this.configService.get<string>('OPENROUTER_MODEL') ||
      DEFAULT_OPENROUTER_MODEL;
    const openrouterBase =
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://openrouter.ai/api/v1';

    if (active === 'ollama') {
      let ollamaConnected = false;
      let ollamaModels: LLMModel[] = [];
      if (ollamaUrl) {
        ollamaConnected = await this.ollamaLlm.testConnection({
          baseUrl: ollamaUrl,
          model: ollamaModel,
        });
        ollamaModels = ollamaConnected
          ? await this.ollamaLlm.getAvailableModels({
              baseUrl: ollamaUrl,
              model: ollamaModel,
            })
          : [];
      }
      const ollamaStatus: LLMProviderStatus = {
        provider: 'ollama',
        enabled: Boolean(s.ollamaEnabled && ollamaUrl),
        connected: ollamaConnected,
        model: ollamaModel,
        availableModels: ollamaModels,
        error: !ollamaUrl
          ? 'חסרה כתובת שרת'
          : !ollamaConnected
            ? 'לא ניתן להתחבר ל-Ollama'
            : undefined,
      };
      return {
        activeProvider: 'ollama',
        providers: {
          ollama: ollamaStatus,
          openrouter: inactive('openrouter'),
        },
      };
    }

    let openrouterConnected = false;
    let openrouterModels: LLMModel[] = [];
    if (openrouterKey?.trim()) {
      openrouterConnected = await this.openrouterLlm.testConnection({
        baseUrl: openrouterBase,
        apiKey: openrouterKey.trim(),
        model: openrouterModel,
      });
      openrouterModels = openrouterConnected
        ? await this.openrouterLlm.getAvailableModels({
            baseUrl: openrouterBase,
            apiKey: openrouterKey.trim(),
            model: openrouterModel,
          })
        : [];
    }
    const openrouterStatus: LLMProviderStatus = {
      provider: 'openrouter',
      enabled: Boolean(openrouterKey?.trim()),
      connected: openrouterConnected,
      model: openrouterModel,
      availableModels: openrouterModels,
      error: !openrouterKey?.trim()
        ? 'מפתח API לא הוגדר'
        : !openrouterConnected
          ? 'לא ניתן להתחבר ל-OpenRouter'
          : undefined,
    };

    return {
      activeProvider: 'openrouter',
      providers: {
        ollama: inactive('ollama'),
        openrouter: openrouterStatus,
      },
    };
  }

  async testProviderForUser(
    userId: string,
    type: LLMEngineId,
    overrides?: { apiKey?: string; url?: string; model?: string },
  ): Promise<boolean> {
    if (type === 'ollama') {
      const s = await this.prisma.userSettings.findUnique({
        where: { userId },
      });
      const url =
        overrides?.url?.trim() ||
        s?.ollamaUrl?.trim() ||
        this.configService.get<string>('OLLAMA_BASE_URL')?.trim() ||
        this.configService.get<string>('OLLAMA_URL')?.trim() ||
        '';
      const model =
        overrides?.model?.trim() ||
        s?.ollamaModel?.trim() ||
        this.configService.get<string>('OLLAMA_MODEL') ||
        DEFAULT_OLLAMA_MODEL;
      if (!url) return false;
      return this.ollamaLlm.testConnection({ baseUrl: url, model });
    }

    const apiKey =
      overrides?.apiKey?.trim() || (await this.decryptOpenrouterKey(userId));
    if (!apiKey) return false;
    const model =
      overrides?.model?.trim() ||
      (await this.prisma.userSettings.findUnique({
        where: { userId },
        select: { openrouterModel: true },
      }))?.openrouterModel?.trim() ||
      this.configService.get<string>('OPENROUTER_MODEL') ||
      DEFAULT_OPENROUTER_MODEL;
    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://openrouter.ai/api/v1';
    return this.openrouterLlm.testConnection({
      baseUrl,
      apiKey,
      model,
    });
  }

  async listModelsForUser(
    userId: string,
    type: LLMEngineId,
    overrides?: { apiKey?: string; url?: string; model?: string },
  ): Promise<LLMModel[]> {
    if (type === 'ollama') {
      const s = await this.prisma.userSettings.findUnique({
        where: { userId },
      });
      const url =
        overrides?.url?.trim() ||
        s?.ollamaUrl?.trim() ||
        this.configService.get<string>('OLLAMA_BASE_URL')?.trim() ||
        this.configService.get<string>('OLLAMA_URL')?.trim() ||
        '';
      const model =
        overrides?.model?.trim() ||
        s?.ollamaModel?.trim() ||
        DEFAULT_OLLAMA_MODEL;
      if (!url) return [];
      return this.ollamaLlm.getAvailableModels({ baseUrl: url, model });
    }

    const apiKey =
      overrides?.apiKey?.trim() || (await this.decryptOpenrouterKey(userId));
    if (!apiKey) return [];
    const model =
      overrides?.model?.trim() ||
      (await this.prisma.userSettings.findUnique({
        where: { userId },
        select: { openrouterModel: true },
      }))?.openrouterModel?.trim() ||
      DEFAULT_OPENROUTER_MODEL;
    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://openrouter.ai/api/v1';
    return this.openrouterLlm.getAvailableModels({
      baseUrl,
      apiKey,
      model,
    });
  }
}
