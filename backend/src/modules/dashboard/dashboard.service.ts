import { Injectable, Logger } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  daysInMonth,
  getIsraelYearMonth,
  getUtcWideRangeForIsraelMonth,
  getIsraelDayOfMonth,
  isInIsraelMonth,
} from '../../common/utils/israel-calendar';

function cashFlowAnchorDate(t: {
  date: Date;
  effectiveDate: Date | null;
}): Date {
  return t.effectiveDate ?? t.date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  /** כבוי = רק עסקאות סופיות בדשבורד; דילוג על pending (לפי UserSettings). */
  private async statusFilterForDashboard(
    userId: string,
  ): Promise<{ status?: TransactionStatus }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { includePendingInDashboard: true },
    });
    const includePending = settings?.includePendingInDashboard ?? true;
    return includePending ? {} : { status: TransactionStatus.COMPLETED };
  }

  /** When month+year are omitted, use calendar month if it has data; else latest month with transactions. */
  private async resolveTargetMonthYear(
    userId: string,
    accountIds: string[],
    month?: number,
    year?: number,
  ): Promise<{ month: number; year: number; usedFallbackToLatestMonth: boolean }> {
    const now = new Date();
    const { month: defaultM, year: defaultY } = getIsraelYearMonth(now);

    const explicit =
      month != null &&
      year != null &&
      !Number.isNaN(month) &&
      !Number.isNaN(year) &&
      month >= 1 &&
      month <= 12;

    if (explicit) {
      return { month: month!, year: year!, usedFallbackToLatestMonth: false };
    }

    let m = month ?? defaultM;
    let y = year ?? defaultY;

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(y, m);
    const statusWhere = await this.statusFilterForDashboard(userId);
    const inMonthRows = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        isExcludedFromCashFlow: false,
        ...statusWhere,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      select: { date: true, effectiveDate: true },
    });
    const countThisMonth = inMonthRows.filter((r) =>
      isInIsraelMonth(cashFlowAnchorDate(r), y, m),
    ).length;

    if (countThisMonth > 0) {
      return { month: m, year: y, usedFallbackToLatestMonth: false };
    }

    const latest = await this.prisma.transaction.findFirst({
      where: {
        accountId: { in: accountIds },
        isExcludedFromCashFlow: false,
        ...statusWhere,
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (!latest) {
      return { month: m, year: y, usedFallbackToLatestMonth: false };
    }

    const d = latest.date;
    const { month: lm, year: ly } = getIsraelYearMonth(d);
    const usedFallback = lm !== defaultM || ly !== defaultY;
    if (usedFallback) {
      this.logger.warn(
        `No transactions in calendar month ${defaultM}/${defaultY}; showing ${lm}/${ly} (latest activity).`,
      );
    }
    return { month: lm, year: ly, usedFallbackToLatestMonth: usedFallback };
  }

  async getCashFlowSummary(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    this.logger.log(`getCashFlowSummary for userId: ${userId}`);

    const now = new Date();
    const { month: calM, year: calY } = getIsraelYearMonth(now);

    if (userAccounts.length === 0) {
      return {
        month: month ?? calM,
        year: year ?? calY,
        usedFallbackToLatestMonth: false,
        usedFallback: false,
        income: { total: 0, fixed: 0, variable: 0 },
        expenses: { total: 0, fixed: 0, tracked: 0, variable: 0 },
        remaining: 0,
        transactionCount: 0,
      };
    }

    const accountIds = userAccounts.map((a) => a.id);

    const { month: targetMonth, year: targetYear, usedFallbackToLatestMonth } =
      await this.resolveTargetMonthYear(userId, accountIds, month, year);

    this.logger.log(`Resolved month: ${targetMonth}/${targetYear}, fallback=${usedFallbackToLatestMonth}`);

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(
      targetYear,
      targetMonth,
    );

    this.logger.log(`Wide UTC range: ${rangeStart.toISOString()} - ${rangeEnd.toISOString()}`);

    const dashStatusWhere = await this.statusFilterForDashboard(userId);
    const transactionsRaw = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        isExcludedFromCashFlow: false,
        ...dashStatusWhere,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      include: { category: true },
    });

    const transactions = transactionsRaw.filter((t) =>
      isInIsraelMonth(cashFlowAnchorDate(t), targetYear, targetMonth),
    );

    this.logger.log(
      `Found ${transactionsRaw.length} in wide range, ${transactions.length} in Israel ${targetMonth}/${targetYear}`,
    );

    if (transactions.length === 0) {
      const allTxns = await this.prisma.transaction.findMany({
        where: { accountId: { in: accountIds } },
        select: { date: true },
        orderBy: { date: 'desc' },
        take: 5,
      });

      if (allTxns.length > 0) {
        this.logger.warn(
          `No transactions in ${targetMonth}/${targetYear}. Latest dates: ${allTxns.map((t) => t.date.toISOString()).join(', ')}`,
        );
      }
    }

    const income = { total: 0, fixed: 0, variable: 0 };
    const expenses = { total: 0, fixed: 0, tracked: 0, variable: 0 };

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      const isIncomeCategory = txn.category?.isIncome === true;

      if (amount > 0 || isIncomeCategory) {
        const incomeAmount = Math.abs(amount);
        income.total += incomeAmount;
        if (txn.category?.isFixed) {
          income.fixed += incomeAmount;
        } else {
          income.variable += incomeAmount;
        }
      } else if (amount < 0 && !isIncomeCategory) {
        const expenseAmount = Math.abs(amount);
        expenses.total += expenseAmount;

        if (txn.category?.isFixed) {
          expenses.fixed += expenseAmount;
        } else if (txn.category?.isTracked) {
          expenses.tracked += expenseAmount;
        } else {
          expenses.variable += expenseAmount;
        }
      }
    }

    const remaining = income.total - expenses.total;

    this.logger.log(`Summary: income=${income.total}, expenses=${expenses.total}, remaining=${remaining}`);

    return {
      month: targetMonth,
      year: targetYear,
      usedFallbackToLatestMonth,
      usedFallback: usedFallbackToLatestMonth,
      income,
      expenses,
      remaining,
      transactionCount: transactions.length,
    };
  }

  async getWeeklyBreakdown(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      return [];
    }

    const accountIds = userAccounts.map((a) => a.id);
    const { month: targetMonth, year: targetYear } = await this.resolveTargetMonthYear(
      userId,
      accountIds,
      month,
      year,
    );

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(
      targetYear,
      targetMonth,
    );

    const dashStatusWhere = await this.statusFilterForDashboard(userId);
    const transactionsRaw = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
        ...dashStatusWhere,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      orderBy: { date: 'asc' },
    });

    const transactions = transactionsRaw.filter((t) =>
      isInIsraelMonth(cashFlowAnchorDate(t), targetYear, targetMonth),
    );

    const weeks: { week: number; startDate: string; endDate: string; total: number }[] = [];

    const dim = daysInMonth(targetYear, targetMonth);
    let weekNum = 1;
    let weekStart = 1;

    while (weekStart <= dim) {
      const weekEnd = Math.min(weekStart + 6, dim);

      const pad = (n: number) => String(n).padStart(2, '0');
      const startLabel = `${targetYear}-${pad(targetMonth)}-${pad(weekStart)}`;
      const endLabel = `${targetYear}-${pad(targetMonth)}-${pad(weekEnd)}`;

      const weekTotal = transactions
        .filter((t) => {
          const d = getIsraelDayOfMonth(cashFlowAnchorDate(t));
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      weeks.push({
        week: weekNum,
        startDate: startLabel,
        endDate: endLabel,
        total: weekTotal,
      });

      weekStart = weekEnd + 1;
      weekNum++;
    }

    return weeks;
  }

  async getCategoryBreakdown(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      return [];
    }

    const accountIds = userAccounts.map((a) => a.id);
    const { month: targetMonth, year: targetYear } = await this.resolveTargetMonthYear(
      userId,
      accountIds,
      month,
      year,
    );

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(
      targetYear,
      targetMonth,
    );

    const dashStatusWhereCat = await this.statusFilterForDashboard(userId);
    const transactionsRaw = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
        ...dashStatusWhereCat,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      include: { category: true },
    });

    const transactions = transactionsRaw.filter((t) =>
      isInIsraelMonth(cashFlowAnchorDate(t), targetYear, targetMonth),
    );

    const uncategorized = await this.prisma.category.findFirst({
      where: { name: 'uncategorized', isSystem: true, userId: null },
      select: { id: true },
    });
    const uncategorizedId = uncategorized?.id ?? null;

    const categoryTotals = new Map<
      string,
      {
        categoryId: string | null;
        name: string;
        nameHe: string;
        icon: string;
        color: string;
        total: number;
        count: number;
      }
    >();

    for (const txn of transactions) {
      const catId = txn.categoryId ?? uncategorizedId ?? 'uncategorized';
      const existing = categoryTotals.get(catId);
      const amount = Math.abs(Number(txn.amount));

      if (existing) {
        existing.total += amount;
        existing.count++;
      } else {
        categoryTotals.set(catId, {
          categoryId: catId === 'uncategorized' ? null : catId,
          name: txn.category?.name || 'uncategorized',
          nameHe: txn.category?.nameHe || 'לא מסווג',
          icon: txn.category?.icon || '❓',
          color: txn.category?.color || '#6b7280',
          total: amount,
          count: 1,
        });
      }
    }

    const breakdown = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total);
    const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);

    return breakdown.map((b) => ({
      ...b,
      percentage: grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0,
    }));
  }

  async getRecentTransactions(userId: string, limit = 10) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      return [];
    }

    const accountIds = userAccounts.map((a) => a.id);
    const dashStatusRecent = await this.statusFilterForDashboard(userId);

    return this.prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, ...dashStatusRecent },
      include: {
        account: {
          select: {
            institutionName: true,
            nickname: true,
            description: true,
          },
        },
        category: { select: { nameHe: true, icon: true, color: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }

  async getAccountsOverview(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        institutionName: true,
        accountNumber: true,
        accountType: true,
        balance: true,
        lastSyncAt: true,
        nickname: true,
        description: true,
      },
    });

    this.logger.log(`Accounts overview for ${userId}: ${accounts.length} accounts`);
    for (const a of accounts) {
      this.logger.log(
        `  ${a.institutionName}: balance=${a.balance} typeof=${typeof a.balance} num=${Number(a.balance)}`,
      );
    }

    const accountsOut = accounts.map((a) => ({
      ...a,
      balance: Number(a.balance) || 0,
    }));

    const totalBalance = accountsOut.reduce((sum, acc) => sum + acc.balance, 0);
    this.logger.log(`Total balance: ${totalBalance}`);

    return {
      accounts: accountsOut,
      totalBalance,
      count: accounts.length,
    };
  }
}
