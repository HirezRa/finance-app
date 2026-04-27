import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Prisma, UserSettings as UserSettingsRow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { computeSalaryEffectiveDateForBankDate } from '../../common/utils/salary-effective-date';
import {
  UpdateOllamaSettingsDto,
  UpdateN8nSettingsDto,
  UpdateLlmSettingsDto,
} from './dto/update-integrations.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  private toPublicUserSettings(row: UserSettingsRow) {
    const {
      githubReleaseTokenEncrypted,
      githubReleaseTokenIv,
      githubReleaseTokenTag,
      openrouterApiKeyEncrypted,
      openrouterApiKeyIv,
      openrouterApiKeyTag,
      ...rest
    } = row;
    return {
      ...rest,
      githubReleaseTokenConfigured: Boolean(
        githubReleaseTokenEncrypted &&
          githubReleaseTokenIv &&
          githubReleaseTokenTag,
      ),
      openrouterApiKeyConfigured: Boolean(
        openrouterApiKeyEncrypted &&
          openrouterApiKeyIv &&
          openrouterApiKeyTag,
      ),
    };
  }

  private async verifyGithubPat(token: string): Promise<void> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch('https://api.github.com/user', {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'finance-app-github-token-verify',
        },
        signal: controller.signal,
      });
      clearTimeout(t);
      if (res.status === 401) {
        throw new BadRequestException('הטוקן נדחה על ידי GitHub.');
      }
      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          throw new BadRequestException(
            'מגבלת בקשות ל-GitHub. נסה שוב בעוד כמה דקות.',
          );
        }
      }
      if (!res.ok) {
        throw new BadRequestException(
          `לא ניתן לאמת את הטוקן (קוד ${res.status}).`,
        );
      }
    } catch (err: unknown) {
      clearTimeout(t);
      if (err instanceof BadRequestException) throw err;
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        throw new BadRequestException('פג הזמן בחיבור ל-GitHub.');
      }
      this.logger.warn('GitHub PAT verify failed', err);
      throw new BadRequestException('שגיאת רשת באימות הטוקן.');
    }
  }

  async saveGithubReleaseToken(userId: string, rawToken: string) {
    const token = rawToken.trim();
    if (!token) {
      throw new BadRequestException('נא להזין טוקן.');
    }
    await this.verifyGithubPat(token);
    const enc = this.encryption.encrypt(token);
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        githubReleaseTokenEncrypted: enc.encryptedData,
        githubReleaseTokenIv: enc.iv,
        githubReleaseTokenTag: enc.authTag,
      },
      create: {
        userId,
        githubReleaseTokenEncrypted: enc.encryptedData,
        githubReleaseTokenIv: enc.iv,
        githubReleaseTokenTag: enc.authTag,
      },
    });
    return this.toPublicUserSettings(row);
  }

  async clearGithubReleaseToken(userId: string) {
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        githubReleaseTokenEncrypted: null,
        githubReleaseTokenIv: null,
        githubReleaseTokenTag: null,
      },
      create: { userId },
    });
    return this.toPublicUserSettings(row);
  }

  /** Decrypted PAT for GitHub API, or null if none stored. */
  async getDecryptedGithubReleaseToken(userId: string): Promise<string | null> {
    const row = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: {
        githubReleaseTokenEncrypted: true,
        githubReleaseTokenIv: true,
        githubReleaseTokenTag: true,
      },
    });
    if (
      !row?.githubReleaseTokenEncrypted ||
      !row.githubReleaseTokenIv ||
      !row.githubReleaseTokenTag
    ) {
      return null;
    }
    try {
      return this.encryption.decrypt(
        row.githubReleaseTokenEncrypted,
        row.githubReleaseTokenIv,
        row.githubReleaseTokenTag,
      );
    } catch (e) {
      this.logger.error('Failed to decrypt GitHub release token', e);
      return null;
    }
  }

  async getUserSettings(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    return this.toPublicUserSettings(settings);
  }

  async updateUserSettings(userId: string, dto: UpdateUserSettingsDto) {
    const data: Prisma.UserSettingsUpdateInput = {};
    if (dto.emailNotifications !== undefined) {
      data.emailNotifications = dto.emailNotifications;
    }
    if (dto.pushNotifications !== undefined) {
      data.pushNotifications = dto.pushNotifications;
    }
    if (dto.weeklyDigest !== undefined) {
      data.weeklyDigest = dto.weeklyDigest;
    }
    if (dto.theme !== undefined) {
      data.theme = dto.theme;
    }
    if (dto.language !== undefined) {
      data.language = dto.language;
    }
    if (dto.dateFormat !== undefined) {
      data.dateFormat = dto.dateFormat;
    }
    if (dto.largeExpenseThreshold !== undefined) {
      data.largeExpenseThreshold = new Prisma.Decimal(dto.largeExpenseThreshold);
    }
    if (dto.budgetWarningEnabled !== undefined) {
      data.budgetWarningEnabled = dto.budgetWarningEnabled;
    }
    if (dto.budgetExceededEnabled !== undefined) {
      data.budgetExceededEnabled = dto.budgetExceededEnabled;
    }
    if (dto.salaryStartDay !== undefined) {
      data.salaryStartDay = dto.salaryStartDay;
    }
    if (dto.salaryEndDay !== undefined) {
      data.salaryEndDay = dto.salaryEndDay;
    }
    if (dto.includePendingInBudget !== undefined) {
      data.includePendingInBudget = dto.includePendingInBudget;
    }
    if (dto.includePendingInDashboard !== undefined) {
      data.includePendingInDashboard = dto.includePendingInDashboard;
    }
    if (dto.excludeCreditCardChargesFromBudget !== undefined) {
      data.excludeCreditCardChargesFromBudget =
        dto.excludeCreditCardChargesFromBudget;
    }
    if (dto.budgetCycleStartDay !== undefined) {
      data.budgetCycleStartDay = dto.budgetCycleStartDay;
    }
    if (dto.monthlySavingsGoal !== undefined) {
      data.monthlySavingsGoal = new Prisma.Decimal(dto.monthlySavingsGoal);
    }
    if (dto.showInactiveAccounts !== undefined) {
      data.showInactiveAccounts = dto.showInactiveAccounts;
    }

    const createData: Prisma.UserSettingsUncheckedCreateInput = { userId };
    if (dto.emailNotifications !== undefined) {
      createData.emailNotifications = dto.emailNotifications;
    }
    if (dto.pushNotifications !== undefined) {
      createData.pushNotifications = dto.pushNotifications;
    }
    if (dto.weeklyDigest !== undefined) {
      createData.weeklyDigest = dto.weeklyDigest;
    }
    if (dto.theme !== undefined) {
      createData.theme = dto.theme;
    }
    if (dto.language !== undefined) {
      createData.language = dto.language;
    }
    if (dto.dateFormat !== undefined) {
      createData.dateFormat = dto.dateFormat;
    }
    if (dto.largeExpenseThreshold !== undefined) {
      createData.largeExpenseThreshold = new Prisma.Decimal(
        dto.largeExpenseThreshold,
      );
    }
    if (dto.budgetWarningEnabled !== undefined) {
      createData.budgetWarningEnabled = dto.budgetWarningEnabled;
    }
    if (dto.budgetExceededEnabled !== undefined) {
      createData.budgetExceededEnabled = dto.budgetExceededEnabled;
    }
    if (dto.salaryStartDay !== undefined) {
      createData.salaryStartDay = dto.salaryStartDay;
    }
    if (dto.salaryEndDay !== undefined) {
      createData.salaryEndDay = dto.salaryEndDay;
    }
    if (dto.includePendingInBudget !== undefined) {
      createData.includePendingInBudget = dto.includePendingInBudget;
    }
    if (dto.includePendingInDashboard !== undefined) {
      createData.includePendingInDashboard = dto.includePendingInDashboard;
    }
    if (dto.excludeCreditCardChargesFromBudget !== undefined) {
      createData.excludeCreditCardChargesFromBudget =
        dto.excludeCreditCardChargesFromBudget;
    }
    if (dto.budgetCycleStartDay !== undefined) {
      createData.budgetCycleStartDay = dto.budgetCycleStartDay;
    }
    if (dto.monthlySavingsGoal !== undefined) {
      createData.monthlySavingsGoal = new Prisma.Decimal(dto.monthlySavingsGoal);
    }
    if (dto.showInactiveAccounts !== undefined) {
      createData.showInactiveAccounts = dto.showInactiveAccounts;
    }

    const shouldRecomputeSalary =
      dto.salaryStartDay !== undefined || dto.salaryEndDay !== undefined;

    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: createData,
    });

    if (shouldRecomputeSalary) {
      await this.recomputeIncomeEffectiveDates(
        userId,
        settings.salaryStartDay,
        settings.salaryEndDay,
      );
    }

    return this.toPublicUserSettings(settings);
  }

  private async recomputeIncomeEffectiveDates(
    userId: string,
    startDay: number,
    endDay: number,
  ) {
    const incomeTxns = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        category: { isIncome: true },
      },
      select: { id: true, date: true },
    });

    for (const txn of incomeTxns) {
      const effectiveDate = computeSalaryEffectiveDateForBankDate(
        txn.date,
        true,
        startDay,
        endDay,
      );
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: { effectiveDate },
      });
    }

    this.logger.log(
      `Updated effectiveDate for ${incomeTxns.length} income transactions (salary ${startDay}-${endDay})`,
    );
  }

  /**
   * מעדכן טווח משכורת ב-DB ומחשב מחדש effectiveDate לכל עסקאות הכנסה של המשתמש.
   */
  async updateSalaryRange(userId: string, startDay: number, endDay: number) {
    await this.prisma.userSettings.upsert({
      where: { userId },
      update: { salaryStartDay: startDay, salaryEndDay: endDay },
      create: { userId, salaryStartDay: startDay, salaryEndDay: endDay },
    });
    await this.recomputeIncomeEffectiveDates(userId, startDay, endDay);
    return {
      success: true as const,
    };
  }

  async getOllamaSettings(userId: string) {
    const settings = await this.getUserSettings(userId);
    return {
      enabled: settings.ollamaEnabled ?? false,
      url: settings.ollamaUrl || '',
      model: settings.ollamaModel || 'qwen2.5:7b',
      llmProvider: settings.llmProvider ?? 'ollama',
    };
  }

  async updateOllamaSettings(userId: string, dto: UpdateOllamaSettingsDto) {
    const update: Prisma.UserSettingsUpdateInput = {};
    if (dto.enabled !== undefined) {
      update.ollamaEnabled = dto.enabled;
      if (dto.enabled) {
        update.llmProvider = 'ollama';
      }
    }
    if (dto.url !== undefined) {
      update.ollamaUrl = dto.url;
    }
    if (dto.model !== undefined) {
      update.ollamaModel = dto.model;
    }

    return this.prisma.userSettings.upsert({
      where: { userId },
      update: update,
      create: {
        userId,
        llmProvider: 'ollama',
        ollamaEnabled: dto.enabled ?? false,
        ollamaUrl: dto.url,
        ollamaModel: dto.model,
      },
    });
  }

  async getLlmIntegrationSettings(userId: string) {
    await this.getUserSettings(userId);
    const s = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    if (!s) {
      throw new NotFoundException('הגדרות לא נמצאו');
    }
    let openrouterKeyHint: string | null = null;
    if (
      s.openrouterApiKeyEncrypted &&
      s.openrouterApiKeyIv &&
      s.openrouterApiKeyTag
    ) {
      try {
        const dec = this.encryption.decrypt(
          s.openrouterApiKeyEncrypted,
          s.openrouterApiKeyIv,
          s.openrouterApiKeyTag,
        );
        if (dec.length >= 4) {
          openrouterKeyHint = `***${dec.slice(-4)}`;
        } else {
          openrouterKeyHint = '***';
        }
      } catch {
        openrouterKeyHint = '***';
      }
    }
    return {
      provider: (s.llmProvider || 'ollama') as 'ollama' | 'openrouter',
      ollama: {
        enabled: s.ollamaEnabled ?? false,
        url: s.ollamaUrl || '',
        model: s.ollamaModel || 'qwen2.5:7b',
      },
      openrouter: {
        model: s.openrouterModel || 'anthropic/claude-3.5-sonnet',
        apiKeyHint: openrouterKeyHint,
        configured: Boolean(
          s.openrouterApiKeyEncrypted &&
            s.openrouterApiKeyIv &&
            s.openrouterApiKeyTag,
        ),
      },
    };
  }

  async updateLlmIntegrationSettings(userId: string, dto: UpdateLlmSettingsDto) {
    const update: Prisma.UserSettingsUpdateInput = {};
    if (dto.provider !== undefined) {
      update.llmProvider = dto.provider;
      update.ollamaEnabled = dto.provider === 'ollama';
    }
    if (dto.ollamaUrl !== undefined) {
      update.ollamaUrl = dto.ollamaUrl;
    }
    if (dto.ollamaModel !== undefined) {
      update.ollamaModel = dto.ollamaModel;
    }
    if (dto.openrouterModel !== undefined) {
      update.openrouterModel = dto.openrouterModel;
    }
    if (dto.openrouterApiKey !== undefined) {
      const t = dto.openrouterApiKey.trim();
      if (t === '') {
        update.openrouterApiKeyEncrypted = null;
        update.openrouterApiKeyIv = null;
        update.openrouterApiKeyTag = null;
      } else {
        const enc = this.encryption.encrypt(t);
        update.openrouterApiKeyEncrypted = enc.encryptedData;
        update.openrouterApiKeyIv = enc.iv;
        update.openrouterApiKeyTag = enc.authTag;
      }
    }

    await this.getUserSettings(userId);
    if (Object.keys(update).length > 0) {
      await this.prisma.userSettings.update({
        where: { userId },
        data: update,
      });
    }
    return this.getLlmIntegrationSettings(userId);
  }

  async testOllamaConnection(url: string, model?: string) {
    try {
      const startTime = Date.now();
      const base = url.replace(/\/$/, '');
      const response = await fetch(`${base}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const data = (await response.json()) as {
        models?: { name: string }[];
      };
      const latencyMs = Date.now() - startTime;
      const models = data.models?.map((m) => m.name) || [];

      if (model && !models.includes(model)) {
        return {
          success: false,
          latencyMs,
          availableModels: models,
          error: `Model "${model}" not found`,
        };
      }

      return {
        success: true,
        latencyMs,
        availableModels: models,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Connection failed';
      return {
        success: false,
        error: message,
      };
    }
  }

  async getN8nSettings(userId: string) {
    const settings = await this.getUserSettings(userId);
    return {
      enabled: settings.n8nEnabled ?? false,
      webhookUrl: settings.n8nWebhookUrl || '',
    };
  }

  async updateN8nSettings(userId: string, dto: UpdateN8nSettingsDto) {
    const update: Prisma.UserSettingsUpdateInput = {};
    if (dto.enabled !== undefined) {
      update.n8nEnabled = dto.enabled;
    }
    if (dto.webhookUrl !== undefined) {
      update.n8nWebhookUrl = dto.webhookUrl;
    }
    if (dto.webhookSecret !== undefined) {
      update.n8nWebhookSecret = dto.webhookSecret;
    }

    return this.prisma.userSettings.upsert({
      where: { userId },
      update: update,
      create: {
        userId,
        n8nEnabled: dto.enabled ?? false,
        n8nWebhookUrl: dto.webhookUrl,
        n8nWebhookSecret: dto.webhookSecret,
      },
    });
  }

  async testN8nWebhook(url: string, secret?: string) {
    try {
      const payload = {
        event: 'test',
        timestamp: new Date().toISOString(),
      };
      const body = JSON.stringify(payload);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (secret) {
        const signature = createHmac('sha256', secret)
          .update(body)
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok
          ? 'Webhook test successful'
          : `HTTP ${response.status}`,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Connection failed';
      return {
        success: false,
        error: message,
      };
    }
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        createdAt: true,
        _count: {
          select: {
            accounts: true,
            categories: true,
            budgets: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    return user;
  }

  async updateUserProfile(userId: string, data: { name?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }
}
