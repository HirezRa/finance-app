import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getIsraelYearMonth,
  getUtcWideRangeForIsraelMonth,
  isInIsraelMonth,
} from '../../common/utils/israel-calendar';

function cashFlowAnchorDate(t: {
  date: Date;
  effectiveDate: Date | null;
}): Date {
  return t.effectiveDate ?? t.date;
}

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(private prisma: PrismaService) {}

  /** כבוי (ברירת מחדל) = תקציב לפי עסקאות סופיות בלבד. */
  private async statusFilterForBudget(
    userId: string,
  ): Promise<{ status?: TransactionStatus }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { includePendingInBudget: true },
    });
    const includePending = settings?.includePendingInBudget ?? false;
    return includePending ? {} : { status: TransactionStatus.COMPLETED };
  }

  async getLatestMonthWithTransactions(userId: string): Promise<{ month: number; year: number } | null> {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userAccounts.length === 0) return null;

    const accountIds = userAccounts.map((a) => a.id);
    const budgetStatusWhere = await this.statusFilterForBudget(userId);

    const latestTxn = await this.prisma.transaction.findFirst({
      where: {
        accountId: { in: accountIds },
        isExcludedFromCashFlow: false,
        ...budgetStatusWhere,
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (!latestTxn) return null;

    return getIsraelYearMonth(latestTxn.date);
  }

  async calculateSpendingByCategory(userId: string, month: number, year: number): Promise<Map<string, number>> {
    this.logger.log(`calculateSpendingByCategory: ${month}/${year} for user ${userId}`);

    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userAccounts.length === 0) {
      this.logger.log('No accounts found');
      return new Map();
    }

    const accountIds = userAccounts.map((a) => a.id);
    this.logger.log(`Account IDs: ${accountIds.join(', ')}`);

    const uncategorized = await this.prisma.category.findFirst({
      where: { name: 'uncategorized', isSystem: true, userId: null },
      select: { id: true },
    });
    const uncategorizedId = uncategorized?.id ?? null;

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(year, month);

    this.logger.log(`Wide UTC query range: ${rangeStart.toISOString()} - ${rangeEnd.toISOString()}`);

    const budgetStatusWhere = await this.statusFilterForBudget(userId);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
        ...budgetStatusWhere,
        OR: [
          { date: { gte: rangeStart, lte: rangeEnd } },
          { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      select: {
        id: true,
        date: true,
        effectiveDate: true,
        categoryId: true,
        amount: true,
        description: true,
      },
    });

    const inMonth = transactions.filter((t) =>
      isInIsraelMonth(cashFlowAnchorDate(t), year, month),
    );
    this.logger.log(`Found ${transactions.length} expense rows in wide range, ${inMonth.length} in Israel ${month}/${year}`);

    const spendingMap = new Map<string, number>();
    for (const txn of inMonth) {
      const catId = txn.categoryId ?? uncategorizedId ?? 'uncategorized';
      const amount = Math.abs(Number(txn.amount));
      const current = spendingMap.get(catId) || 0;
      spendingMap.set(catId, current + amount);
    }

    this.logger.log(`Spending map: ${JSON.stringify(Object.fromEntries(spendingMap))}`);
    return spendingMap;
  }

  async ensureAllCategoriesInBudget(userId: string, budgetId: string) {
    const expenseCategories = await this.prisma.category.findMany({
      where: {
        OR: [
          { userId, isIncome: false },
          { userId: null, isSystem: true, isIncome: false },
        ],
      },
      select: { id: true },
    });

    const existingBudgetCats = await this.prisma.budgetCategory.findMany({
      where: { budgetId },
      select: { categoryId: true },
    });

    const existingIds = new Set(existingBudgetCats.map((bc) => bc.categoryId));
    const missing = expenseCategories.filter((c) => !existingIds.has(c.id));

    if (missing.length > 0) {
      const maxRow = await this.prisma.budgetCategory.aggregate({
        where: { budgetId },
        _max: { sortOrder: true },
      });
      let nextOrder = (maxRow._max.sortOrder ?? -1) + 1;
      await this.prisma.budgetCategory.createMany({
        data: missing.map((c) => ({
          budgetId,
          categoryId: c.id,
          amount: new Prisma.Decimal(0),
          sortOrder: nextOrder++,
        })),
      });
      this.logger.log(`Added ${missing.length} missing expense categories to budget ${budgetId}`);
    }
  }

  async findByMonth(userId: string, month: number, year: number) {
    this.logger.log(`findByMonth: ${month}/${year} for user ${userId}`);

    let budget = await this.prisma.budget.findUnique({
      where: { userId_month_year: { userId, month, year } },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                nameHe: true,
                icon: true,
                color: true,
                isFixed: true,
                isTracked: true,
              },
            },
          },
        },
      },
    });

    if (budget) {
      await this.ensureAllCategoriesInBudget(userId, budget.id);
      budget = await this.prisma.budget.findUnique({
        where: { userId_month_year: { userId, month, year } },
        include: {
          categories: {
            orderBy: { sortOrder: 'asc' },
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  nameHe: true,
                  icon: true,
                  color: true,
                  isFixed: true,
                  isTracked: true,
                },
              },
            },
          },
        },
      });
    }

    const spendingMap = await this.calculateSpendingByCategory(userId, month, year);
    const totalSpent = Array.from(spendingMap.values()).reduce((sum, v) => sum + v, 0);

    if (!budget) {
      return {
        id: null as string | null,
        month,
        year,
        categories: [] as Array<{
          id: string;
          categoryId: string;
          category: {
            id: string;
            name: string;
            nameHe: string;
            icon: string | null;
            color: string | null;
            isFixed: boolean;
            isTracked: boolean;
          };
          budgetAmount: number;
          spent: number;
          remaining: number;
          percentage: number;
          status: 'ok' | 'warning' | 'exceeded';
        }>,
        summary: {
          totalBudget: 0,
          totalSpent,
          totalRemaining: -totalSpent,
          overallPercentage: 0,
        },
        spendingByCategory: Object.fromEntries(spendingMap),
      };
    }

    const categoriesWithSpending = budget.categories.map((bc) => {
      const budgetAmount = Number(bc.amount);
      const spent = spendingMap.get(bc.categoryId) || 0;
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;

      return {
        id: bc.id,
        categoryId: bc.categoryId,
        category: bc.category,
        budgetAmount,
        spent,
        remaining,
        percentage,
        status: (percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok') as
          | 'exceeded'
          | 'warning'
          | 'ok',
      };
    });

    const totalBudget = categoriesWithSpending.reduce((sum, c) => sum + c.budgetAmount, 0);
    const totalBudgetSpent = categoriesWithSpending.reduce((sum, c) => sum + c.spent, 0);

    return {
      id: budget.id,
      month,
      year,
      categories: categoriesWithSpending,
      summary: {
        totalBudget,
        totalSpent: totalBudgetSpent,
        totalRemaining: totalBudget - totalBudgetSpent,
        overallPercentage: totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0,
      },
      spendingByCategory: Object.fromEntries(spendingMap),
    };
  }

  async findByMonthWithFallback(userId: string, requestedMonth?: number, requestedYear?: number) {
    const now = new Date();
    const { month: currentMonth, year: currentYear } = getIsraelYearMonth(now);

    let targetMonth = requestedMonth ?? currentMonth;
    let targetYear = requestedYear ?? currentYear;
    let usedFallback = false;

    if (requestedMonth === undefined && requestedYear === undefined) {
      const userAccounts = await this.prisma.account.findMany({
        where: { userId },
        select: { id: true },
      });
      const accountIds = userAccounts.map((a) => a.id);

      if (accountIds.length > 0) {
        const { start, end } = getUtcWideRangeForIsraelMonth(targetYear, targetMonth);
        const budgetStatusFallback = await this.statusFilterForBudget(userId);
        const rows = await this.prisma.transaction.findMany({
          where: {
            accountId: { in: accountIds },
            isExcludedFromCashFlow: false,
            ...budgetStatusFallback,
            OR: [
              { date: { gte: start, lte: end } },
              { effectiveDate: { gte: start, lte: end } },
            ],
          },
          select: { date: true, effectiveDate: true },
        });
        const countInMonth = rows.filter((r) =>
          isInIsraelMonth(cashFlowAnchorDate(r), targetYear, targetMonth),
        ).length;

        if (countInMonth === 0) {
          const latest = await this.getLatestMonthWithTransactions(userId);
          if (latest) {
            targetMonth = latest.month;
            targetYear = latest.year;
            usedFallback = true;
            this.logger.log(`Budget fallback to ${targetMonth}/${targetYear} (no txns in Israel ${currentMonth}/${currentYear})`);
          }
        }
      }
    }

    const result = await this.findByMonth(userId, targetMonth, targetYear);

    return {
      ...result,
      requestedMonth: requestedMonth ?? currentMonth,
      requestedYear: requestedYear ?? currentYear,
      usedFallback,
      displayMonth: targetMonth,
      displayYear: targetYear,
    };
  }

  async create(
    userId: string,
    dto: { month: number; year: number; categories: { categoryId: string; amount: number }[] },
  ) {
    this.logger.log(`Creating budget for ${dto.month}/${dto.year}`);

    const existing = await this.prisma.budget.findUnique({
      where: { userId_month_year: { userId, month: dto.month, year: dto.year } },
    });

    if (existing) {
      await this.prisma.budgetCategory.deleteMany({ where: { budgetId: existing.id } });
      await this.prisma.budget.delete({ where: { id: existing.id } });
    }

    const lines = dto.categories.filter((c) => c.amount > 0);

    await this.prisma.budget.create({
      data: {
        userId,
        month: dto.month,
        year: dto.year,
        categories: {
          create: lines.map((c, index) => ({
            categoryId: c.categoryId,
            amount: new Prisma.Decimal(c.amount),
            sortOrder: index,
          })),
        },
      },
    });

    return this.findByMonth(userId, dto.month, dto.year);
  }

  async update(
    userId: string,
    month: number,
    year: number,
    dto: { categories: { categoryId: string; amount: number }[] },
  ) {
    this.logger.log(`Updating budget for ${month}/${year}`);

    const budget = await this.prisma.budget.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!budget) {
      return this.create(userId, { month, year, categories: dto.categories });
    }

    await this.prisma.budgetCategory.deleteMany({ where: { budgetId: budget.id } });

    const lines = dto.categories.filter((c) => c.amount > 0);

    await this.prisma.budgetCategory.createMany({
      data: lines.map((c, index) => ({
        budgetId: budget.id,
        categoryId: c.categoryId,
        amount: new Prisma.Decimal(c.amount),
        sortOrder: index,
      })),
    });

    return this.findByMonth(userId, month, year);
  }

  async copyFromPreviousMonth(userId: string, targetMonth: number, targetYear: number) {
    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear--;
    }

    this.logger.log(`Copying budget from ${prevMonth}/${prevYear} to ${targetMonth}/${targetYear}`);

    let sourceBudget = await this.prisma.budget.findUnique({
      where: { userId_month_year: { userId, month: prevMonth, year: prevYear } },
      include: { categories: true },
    });

    if (!sourceBudget) {
      let pm = prevMonth;
      let py = prevYear;
      for (let i = 0; i < 12; i++) {
        pm--;
        if (pm < 1) {
          pm = 12;
          py--;
        }

        sourceBudget = await this.prisma.budget.findUnique({
          where: { userId_month_year: { userId, month: pm, year: py } },
          include: { categories: true },
        });

        if (sourceBudget) {
          prevMonth = pm;
          prevYear = py;
          break;
        }
      }
    }

    if (!sourceBudget) {
      throw new NotFoundException('לא נמצא תקציב קודם להעתקה');
    }

    this.logger.log(
      `Found source budget from ${prevMonth}/${prevYear} with ${sourceBudget.categories.length} categories`,
    );

    const sortedSource = [...sourceBudget.categories].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return this.create(userId, {
      month: targetMonth,
      year: targetYear,
      categories: sortedSource.map((c) => ({
        categoryId: c.categoryId,
        amount: Number(c.amount),
      })),
    });
  }

  async delete(userId: string, month: number, year: number) {
    const budget = await this.prisma.budget.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!budget) {
      throw new NotFoundException('תקציב לא נמצא');
    }

    await this.prisma.budget.delete({ where: { id: budget.id } });

    return { message: 'תקציב נמחק' };
  }

  async getHistory(userId: string, months = 6) {
    const now = new Date();
    const history: Array<{
      month: number;
      year: number;
      hasBudget: boolean;
      hasTransactions: boolean;
      summary: {
        totalBudget: number;
        totalSpent: number;
        totalRemaining: number;
        overallPercentage: number;
      };
    }> = [];

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const budget = await this.findByMonth(userId, month, year);

      history.push({
        month,
        year,
        hasBudget: budget.id !== null,
        hasTransactions: budget.summary.totalSpent > 0,
        summary: budget.summary,
      });
    }

    return history;
  }

  /** @deprecated use getHistory */
  async getBudgetHistory(userId: string, months = 6) {
    return this.getHistory(userId, months);
  }

  async updateCategoryOrder(
    userId: string,
    budgetCategoryId: string,
    newOrder: number,
  ) {
    const budgetCategory = await this.prisma.budgetCategory.findFirst({
      where: {
        id: budgetCategoryId,
        budget: { userId },
      },
    });

    if (!budgetCategory) {
      throw new NotFoundException('שורת תקציב לא נמצאה');
    }

    return this.prisma.budgetCategory.update({
      where: { id: budgetCategoryId },
      data: { sortOrder: newOrder },
    });
  }

  async reorderCategories(userId: string, budgetId: string, orderedIds: string[]) {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new BadRequestException('orderedIds נדרש');
    }

    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new NotFoundException('תקציב לא נמצא');
    }

    const rows = await this.prisma.budgetCategory.findMany({
      where: { budgetId },
      select: { id: true },
    });
    const idSet = new Set(rows.map((r) => r.id));
    for (const id of orderedIds) {
      if (!idSet.has(id)) {
        throw new BadRequestException('מזהה שורה לא שייך לתקציב זה');
      }
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.budgetCategory.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { success: true as const, count: orderedIds.length };
  }

  async moveCategoryUpDown(
    userId: string,
    budgetCategoryId: string,
    direction: 'up' | 'down',
  ) {
    const budgetCategory = await this.prisma.budgetCategory.findFirst({
      where: {
        id: budgetCategoryId,
        budget: { userId },
      },
    });

    if (!budgetCategory) {
      throw new NotFoundException('שורת תקציב לא נמצאה');
    }

    const allCategories = await this.prisma.budgetCategory.findMany({
      where: { budgetId: budgetCategory.budgetId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const currentIndex = allCategories.findIndex((c) => c.id === budgetCategoryId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= allCategories.length) {
      return { success: false as const, message: 'לא ניתן להזיז עוד' };
    }

    const reordered = [...allCategories];
    const tmp = reordered[currentIndex];
    reordered[currentIndex] = reordered[newIndex];
    reordered[newIndex] = tmp;

    await this.prisma.$transaction(
      reordered.map((c, index) =>
        this.prisma.budgetCategory.update({
          where: { id: c.id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { success: true as const };
  }
}
