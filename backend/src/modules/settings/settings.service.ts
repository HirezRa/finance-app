import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { computeSalaryEffectiveDateForBankDate } from '../../common/utils/salary-effective-date';
import {
  UpdateOllamaSettingsDto,
  UpdateN8nSettingsDto,
} from './dto/update-integrations.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserSettings(userId: string) {
    let settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.userSettings.create({
        data: { userId },
      });
    }

    return settings;
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

    return settings;
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
    };
  }

  async updateOllamaSettings(userId: string, dto: UpdateOllamaSettingsDto) {
    const update: Prisma.UserSettingsUpdateInput = {};
    if (dto.enabled !== undefined) {
      update.ollamaEnabled = dto.enabled;
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
        ollamaEnabled: dto.enabled ?? false,
        ollamaUrl: dto.url,
        ollamaModel: dto.model,
      },
    });
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
