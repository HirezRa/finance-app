import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
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
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { sortOrder: 'asc' },
        { nameHe: 'asc' },
      ],
    });
  }

  async findOne(id: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    return category;
  }

  async checkDuplicate(userId: string, name?: string, nameHe?: string) {
    const n = name?.trim();
    const nh = nameHe?.trim();
    if (!n && !nh) {
      return { hasDuplicate: false, duplicates: [] };
    }

    const or: Prisma.CategoryWhereInput[] = [];
    if (n) {
      or.push({ userId, name: n });
      or.push({ userId: null, isSystem: true, name: n });
    }
    if (nh) {
      or.push({ userId, nameHe: nh });
      or.push({ userId: null, isSystem: true, nameHe: nh });
    }

    const duplicates = await this.prisma.category.findMany({
      where: { OR: or },
      select: { id: true, name: true, nameHe: true, isSystem: true },
    });

    return { hasDuplicate: duplicates.length > 0, duplicates };
  }

  async create(userId: string, dto: CreateCategoryDto) {
    this.logger.log(`Creating category for user ${userId}: ${JSON.stringify(dto)}`);

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [
          { userId, name: dto.name },
          { userId, nameHe: dto.nameHe },
          { userId: null, isSystem: true, name: dto.name },
          { userId: null, isSystem: true, nameHe: dto.nameHe },
        ],
      },
    });

    if (existing) {
      throw new ConflictException({
        message: 'קטגוריה עם שם זהה כבר קיימת',
        existingCategory: {
          id: existing.id,
          name: existing.name,
          nameHe: existing.nameHe,
          isSystem: existing.isSystem,
        },
      });
    }

    const keywordsJson =
      dto.keywords !== undefined
        ? (dto.keywords as unknown as Prisma.InputJsonValue)
        : ([] as unknown as Prisma.InputJsonValue);

    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        nameHe: dto.nameHe,
        icon: dto.icon ?? '❓',
        color: dto.color ?? '#3b82f6',
        parentId: dto.parentId,
        isIncome: dto.isIncome ?? false,
        isFixed: dto.isFixed ?? false,
        isTracked: dto.isTracked !== undefined ? dto.isTracked : true,
        keywords: keywordsJson,
      },
    });
  }

  async update(id: string, userId: string, dto: Partial<CreateCategoryDto>) {
    this.logger.log(`Updating category ${id}: ${JSON.stringify(dto)}`);

    const category = await this.prisma.category.findFirst({
      where: {
        id,
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    // קטגוריות מערכת ומשתמש — עריכה מלאה (מחיקה עדיין חסומה למערכת ב-delete)
    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.nameHe !== undefined) data.nameHe = dto.nameHe;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    if (dto.isIncome !== undefined) data.isIncome = dto.isIncome;
    if (dto.isFixed !== undefined) data.isFixed = dto.isFixed;
    if (dto.isTracked !== undefined) data.isTracked = dto.isTracked;
    if (dto.keywords !== undefined) {
      data.keywords = dto.keywords as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    if (category.isSystem) {
      throw new BadRequestException('לא ניתן למחוק קטגוריות מערכת');
    }

    await this.prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    });

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async getIncomeCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
        isIncome: true,
      },
      orderBy: { nameHe: 'asc' },
    });
  }

  async getExpenseCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
        isIncome: false,
      },
      orderBy: [
        { isFixed: 'desc' },
        { isTracked: 'desc' },
        { nameHe: 'asc' },
      ],
    });
  }

  async getCategoriesWithStats(userId: string, month?: number, year?: number) {
    const now = new Date();
    let targetMonth: number;
    let targetYear: number;
    if (
      month != null &&
      year != null &&
      !Number.isNaN(month) &&
      !Number.isNaN(year) &&
      month >= 1 &&
      month <= 12
    ) {
      targetMonth = month;
      targetYear = year;
    } else {
      const i = getIsraelYearMonth(now);
      targetMonth = i.month;
      targetYear = i.year;
    }

    this.logger.log(`getCategoriesWithStats: Israel month ${targetMonth}/${targetYear}`);

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForIsraelMonth(
      targetYear,
      targetMonth,
    );
    this.logger.log(`Wide UTC range: ${rangeStart.toISOString()} - ${rangeEnd.toISOString()}`);

    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      orderBy: [
        { isSystem: 'desc' },
        { sortOrder: 'asc' },
        { nameHe: 'asc' },
      ],
    });

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const uncategorized = await this.prisma.category.findFirst({
      where: { name: 'uncategorized', isSystem: true, userId: null },
      select: { id: true },
    });
    const uncategorizedId = uncategorized?.id ?? null;

    const statsMap = new Map<string, { count: number; total: number }>();

    if (accountIds.length > 0) {
      const transactionsRaw = await this.prisma.transaction.findMany({
        where: {
          accountId: { in: accountIds },
          isExcludedFromCashFlow: false,
          OR: [
            { date: { gte: rangeStart, lte: rangeEnd } },
            { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
        select: {
          categoryId: true,
          amount: true,
          date: true,
          effectiveDate: true,
        },
      });

      const transactions = transactionsRaw.filter((t) =>
        isInIsraelMonth(cashFlowAnchorDate(t), targetYear, targetMonth),
      );

      for (const txn of transactions) {
        const catId = txn.categoryId ?? uncategorizedId;
        if (!catId) continue;
        const current = statsMap.get(catId) || { count: 0, total: 0 };
        current.count++;
        current.total += Math.abs(Number(txn.amount));
        statsMap.set(catId, current);
      }
    }

    const result = categories.map((cat) => {
      const stats = statsMap.get(cat.id) || { count: 0, total: 0 };
      return {
        ...cat,
        transactionCount: stats.count,
        totalAmount: stats.total,
        month: targetMonth,
        year: targetYear,
      };
    });

    return {
      categories: result,
      month: targetMonth,
      year: targetYear,
      summary: {
        totalCategories: categories.length,
        incomeCategories: categories.filter((c) => c.isIncome).length,
        expenseCategories: categories.filter((c) => !c.isIncome).length,
      },
    };
  }
}
