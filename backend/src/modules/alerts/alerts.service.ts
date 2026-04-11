import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

export interface Alert {
  id: string;
  type: 'budget_exceeded' | 'budget_warning' | 'large_expense' | 'sync_error' | 'weekly_summary';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  isRead: boolean;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 8 * * *')
  async checkBudgetAlerts() {
    this.logger.log('Running daily budget check...');

    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      await this.checkUserBudgetAlerts(user.id);
    }
  }

  async checkUserBudgetAlerts(userId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const warnEnabled = userSettings?.budgetWarningEnabled !== false;
    const exceededEnabled = userSettings?.budgetExceededEnabled !== false;

    const budget = await this.prisma.budget.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!budget) return alerts;

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const spending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    const spendingMap = new Map(
      spending
        .filter((s): s is typeof s & { categoryId: string } => s.categoryId != null)
        .map((s) => [s.categoryId, Math.abs(Number(s._sum.amount) || 0)]),
    );

    for (const bc of budget.categories) {
      const budgetAmount = Number(bc.amount);
      const spent = spendingMap.get(bc.categoryId) || 0;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

      if (percentage >= 100 && exceededEnabled) {
        alerts.push({
          id: `budget-exceeded-${bc.categoryId}-${month}-${year}`,
          type: 'budget_exceeded',
          severity: 'error',
          title: `חריגה מתקציב: ${bc.category.nameHe}`,
          message: `הוצאת ${this.formatCurrency(spent)} מתוך ${this.formatCurrency(budgetAmount)} (${Math.round(percentage)}%)`,
          data: {
            categoryId: bc.categoryId,
            categoryName: bc.category.nameHe,
            budgetAmount,
            spent,
            percentage: Math.round(percentage),
          },
          createdAt: new Date(),
          isRead: false,
        });
      } else if (percentage >= 80 && warnEnabled) {
        alerts.push({
          id: `budget-warning-${bc.categoryId}-${month}-${year}`,
          type: 'budget_warning',
          severity: 'warning',
          title: `אזהרת תקציב: ${bc.category.nameHe}`,
          message: `הגעת ל-${Math.round(percentage)}% מהתקציב (${this.formatCurrency(spent)} מתוך ${this.formatCurrency(budgetAmount)})`,
          data: {
            categoryId: bc.categoryId,
            categoryName: bc.category.nameHe,
            budgetAmount,
            spent,
            percentage: Math.round(percentage),
            remaining: budgetAmount - spent,
          },
          createdAt: new Date(),
          isRead: false,
        });
      }
    }

    const totalBudget = budget.categories.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalSpent = Array.from(spendingMap.values()).reduce((sum, val) => sum + val, 0);
    const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    if (totalPercentage >= 100 && exceededEnabled) {
      alerts.push({
        id: `total-budget-exceeded-${month}-${year}`,
        type: 'budget_exceeded',
        severity: 'error',
        title: 'חריגה מהתקציב הכולל',
        message: `הוצאת ${this.formatCurrency(totalSpent)} מתוך ${this.formatCurrency(totalBudget)} (${Math.round(totalPercentage)}%)`,
        data: {
          totalBudget,
          totalSpent,
          percentage: Math.round(totalPercentage),
        },
        createdAt: new Date(),
        isRead: false,
      });
    }

    return alerts;
  }

  async checkLargeExpense(
    userId: string,
    transaction: { id: string; amount: unknown; description: string },
  ): Promise<Alert | null> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const threshold = Number(settings?.largeExpenseThreshold) || 500;
    const amount = Math.abs(Number(transaction.amount));

    if (amount >= threshold && Number(transaction.amount) < 0) {
      return {
        id: `large-expense-${transaction.id}`,
        type: 'large_expense',
        severity: 'info',
        title: 'הוצאה גדולה',
        message: `${transaction.description}: ${this.formatCurrency(amount)}`,
        data: {
          transactionId: transaction.id,
          amount,
          description: transaction.description,
          threshold,
        },
        createdAt: new Date(),
        isRead: false,
      };
    }

    return null;
  }

  /** Raw alerts (isRead always false); merged with dismissed ids in getUserAlerts. */
  private async gatherAlerts(userId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    const budgetAlerts = await this.checkUserBudgetAlerts(userId);
    alerts.push(...budgetAlerts);

    const syncErrors = await this.prisma.scraperConfig.findMany({
      where: {
        userId,
        lastSyncStatus: 'error',
      },
      select: {
        id: true,
        companyDisplayName: true,
        lastError: true,
        lastSyncAt: true,
      },
    });

    for (const config of syncErrors) {
      alerts.push({
        id: `sync-error-${config.id}`,
        type: 'sync_error',
        severity: 'error',
        title: `שגיאת סנכרון: ${config.companyDisplayName}`,
        message: config.lastError || 'שגיאה לא ידועה',
        data: {
          configId: config.id,
          lastSyncAt: config.lastSyncAt,
        },
        createdAt: config.lastSyncAt || new Date(),
        isRead: false,
      });
    }

    alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return alerts;
  }

  async getUserAlerts(userId: string): Promise<Alert[]> {
    const [alerts, settings] = await Promise.all([
      this.gatherAlerts(userId),
      this.prisma.userSettings.findUnique({
        where: { userId },
        select: { dismissedAlertIds: true },
      }),
    ]);
    const dismissed = new Set(settings?.dismissedAlertIds ?? []);
    return alerts.map((a) => ({ ...a, isRead: dismissed.has(a.id) }));
  }

  async markAlertRead(userId: string, alertId: string): Promise<void> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { dismissedAlertIds: true },
    });
    const current = settings?.dismissedAlertIds ?? [];
    if (current.includes(alertId)) return;
    const next = [...current, alertId].slice(-500);
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, dismissedAlertIds: [alertId] },
      update: { dismissedAlertIds: { set: next } },
    });
  }

  async markAllAlertsRead(userId: string): Promise<void> {
    const alerts = await this.gatherAlerts(userId);
    const ids = alerts.map((a) => a.id);
    if (ids.length === 0) return;
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { dismissedAlertIds: true },
    });
    const current = settings?.dismissedAlertIds ?? [];
    const merged = [...new Set([...current, ...ids])].slice(-500);
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, dismissedAlertIds: merged },
      update: { dismissedAlertIds: { set: merged } },
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}
