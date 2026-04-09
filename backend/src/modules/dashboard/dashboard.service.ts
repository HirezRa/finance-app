import { Injectable, Logger } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getUtcWideRangeForBudgetCycle,
  isInBudgetCycle,
  getBudgetCycleLabelForIsraelDate,
  buildBudgetCycleWeekBuckets,
  israelYmdInDayList,
  shiftBudgetCycleLabel,
} from '../../common/utils/budget-cycle';

function cashFlowAnchorDate(t: {
  date: Date;
  effectiveDate: Date | null;
}): Date {
  return t.effectiveDate ?? t.date;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private static readonly HEBREW_MONTHS = [
    '',
    'ינואר',
    'פברואר',
    'מרץ',
    'אפריל',
    'מאי',
    'יוני',
    'יולי',
    'אוגוסט',
    'ספטמבר',
    'אוקטובר',
    'נובמבר',
    'דצמבר',
  ];

  constructor(private prisma: PrismaService) {}

  private hebrewMonthName(month: number): string {
    return DashboardService.HEBREW_MONTHS[month] ?? '';
  }

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

  private async loadBudgetCyclePrefs(userId: string): Promise<{
    cycleStartDay: number;
    monthlySavingsGoal: number;
  }> {
    const s = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { budgetCycleStartDay: true, monthlySavingsGoal: true },
    });
    return {
      cycleStartDay: s?.budgetCycleStartDay ?? 1,
      monthlySavingsGoal: Number(s?.monthlySavingsGoal ?? 0),
    };
  }

  /** When month+year are omitted, use current budget cycle if it has data; else latest cycle with activity. */
  private async resolveTargetMonthYear(
    userId: string,
    accountIds: string[],
    month: number | undefined,
    year: number | undefined,
    cycleStartDay: number,
  ): Promise<{ month: number; year: number; usedFallbackToLatestMonth: boolean }> {
    const now = new Date();
    const { month: defaultM, year: defaultY } = getBudgetCycleLabelForIsraelDate(
      now,
      cycleStartDay,
    );

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

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      y,
      m,
      cycleStartDay,
    );
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
    const countThisCycle = inMonthRows.filter((r) =>
      isInBudgetCycle(cashFlowAnchorDate(r), y, m, cycleStartDay),
    ).length;

    if (countThisCycle > 0) {
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
    const { month: lm, year: ly } = getBudgetCycleLabelForIsraelDate(d, cycleStartDay);
    const usedFallback = lm !== defaultM || ly !== defaultY;
    if (usedFallback) {
      this.logger.warn(
        `No transactions in budget cycle ${defaultM}/${defaultY}; showing ${lm}/${ly} (latest activity).`,
      );
    }
    return { month: lm, year: ly, usedFallbackToLatestMonth: usedFallback };
  }

  async getCashFlowSummary(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    this.logger.log(`getCashFlowSummary for userId: ${userId}`);

    const now = new Date();
    const prefs = await this.loadBudgetCyclePrefs(userId);
    const { month: calM, year: calY } = getBudgetCycleLabelForIsraelDate(
      now,
      prefs.cycleStartDay,
    );

    if (userAccounts.length === 0) {
      return {
        month: month ?? calM,
        year: year ?? calY,
        usedFallbackToLatestMonth: false,
        usedFallback: false,
        income: { total: 0, fixed: 0, variable: 0 },
        expenses: { total: 0, fixed: 0, tracked: 0, variable: 0 },
        remaining: 0,
        balance: 0,
        availableBalance: 0,
        monthlySavingsGoal: prefs.monthlySavingsGoal,
        budgetCycleStartDay: prefs.cycleStartDay,
        transactionCount: 0,
      };
    }

    const accountIds = userAccounts.map((a) => a.id);

    const { month: targetMonth, year: targetYear, usedFallbackToLatestMonth } =
      await this.resolveTargetMonthYear(
        userId,
        accountIds,
        month,
        year,
        prefs.cycleStartDay,
      );

    this.logger.log(`Resolved month: ${targetMonth}/${targetYear}, fallback=${usedFallbackToLatestMonth}`);

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      targetYear,
      targetMonth,
      prefs.cycleStartDay,
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
      isInBudgetCycle(cashFlowAnchorDate(t), targetYear, targetMonth, prefs.cycleStartDay),
    );

    this.logger.log(
      `Found ${transactionsRaw.length} in wide range, ${transactions.length} in budget cycle ${targetMonth}/${targetYear} (startDay=${prefs.cycleStartDay})`,
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
    const availableBalance = remaining - prefs.monthlySavingsGoal;

    this.logger.log(`Summary: income=${income.total}, expenses=${expenses.total}, remaining=${remaining}`);

    return {
      month: targetMonth,
      year: targetYear,
      usedFallbackToLatestMonth,
      usedFallback: usedFallbackToLatestMonth,
      income,
      expenses,
      remaining,
      balance: remaining,
      availableBalance,
      monthlySavingsGoal: prefs.monthlySavingsGoal,
      budgetCycleStartDay: prefs.cycleStartDay,
      transactionCount: transactions.length,
    };
  }

  async getWeeklyBreakdown(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      return [];
    }

    const accountIds = userAccounts.map((a) => a.id);
    const prefs = await this.loadBudgetCyclePrefs(userId);
    const { month: targetMonth, year: targetYear } = await this.resolveTargetMonthYear(
      userId,
      accountIds,
      month,
      year,
      prefs.cycleStartDay,
    );

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      targetYear,
      targetMonth,
      prefs.cycleStartDay,
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
      isInBudgetCycle(cashFlowAnchorDate(t), targetYear, targetMonth, prefs.cycleStartDay),
    );

    const buckets = buildBudgetCycleWeekBuckets(
      targetYear,
      targetMonth,
      prefs.cycleStartDay,
    );

    return buckets.map((b) => ({
      week: b.week,
      startDate: b.startDate,
      endDate: b.endDate,
      total: transactions
        .filter((t) => israelYmdInDayList(cashFlowAnchorDate(t), b.days))
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
    }));
  }

  async getCategoryBreakdown(userId: string, month?: number, year?: number) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      return [];
    }

    const accountIds = userAccounts.map((a) => a.id);
    const prefs = await this.loadBudgetCyclePrefs(userId);
    const { month: targetMonth, year: targetYear } = await this.resolveTargetMonthYear(
      userId,
      accountIds,
      month,
      year,
      prefs.cycleStartDay,
    );

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      targetYear,
      targetMonth,
      prefs.cycleStartDay,
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
      isInBudgetCycle(cashFlowAnchorDate(t), targetYear, targetMonth, prefs.cycleStartDay),
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

  /**
   * סיכום הכנסות/הוצאות לפי מחזורי תקציב (כמו הדשבורד), X מחזורים אחורה — מהישן לחדש.
   */
  async getHistory(userId: string, monthsCount: number) {
    const n = Math.min(12, Math.max(3, Math.floor(monthsCount) || 6));
    const { cycleStartDay } = await this.loadBudgetCyclePrefs(userId);
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return [];
    }

    const statusWhere = await this.statusFilterForDashboard(userId);
    const now = new Date();
    const cur = getBudgetCycleLabelForIsraelDate(now, cycleStartDay);
    const oldest = shiftBudgetCycleLabel(cur.month, cur.year, -(n - 1));

    const { start: rangeStart } = getUtcWideRangeForBudgetCycle(
      oldest.year,
      oldest.month,
      cycleStartDay,
    );
    const { end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      cur.year,
      cur.month,
      cycleStartDay,
    );

    const raw = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        isExcludedFromCashFlow: false,
        ...statusWhere,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      include: { category: true },
    });

    const history: Array<{
      month: number;
      year: number;
      label: string;
      income: number;
      expenses: number;
      balance: number;
      transactionCount: number;
    }> = [];

    for (let i = n - 1; i >= 0; i--) {
      const { month, year } = shiftBudgetCycleLabel(cur.month, cur.year, -i);
      const filtered = raw.filter((t) =>
        isInBudgetCycle(cashFlowAnchorDate(t), year, month, cycleStartDay),
      );

      const income = { total: 0 };
      const expenses = { total: 0 };

      for (const txn of filtered) {
        const amount = Number(txn.amount);
        const isIncomeCategory = txn.category?.isIncome === true;

        if (amount > 0 || isIncomeCategory) {
          income.total += Math.abs(amount);
        } else if (amount < 0 && !isIncomeCategory) {
          expenses.total += Math.abs(amount);
        }
      }

      const balance = income.total - expenses.total;
      history.push({
        month,
        year,
        label: `${this.hebrewMonthName(month)} ${year}`,
        income: Math.round(income.total * 100) / 100,
        expenses: Math.round(expenses.total * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        transactionCount: filtered.length,
      });
    }

    return history;
  }

  async getRecentTransactions(userId: string, limit = 10) {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
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
