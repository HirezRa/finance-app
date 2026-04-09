import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import {
  getUtcWideRangeForBudgetCycle,
  isInBudgetCycle,
  getBudgetCycleLabelForIsraelDate,
} from '../../common/utils/budget-cycle';

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

  /** כמו תקציבים: ללא pending כש־includePendingInBudget כבוי (ברירת מחדל). */
  private async statusFilterAlignedWithBudget(
    userId: string,
  ): Promise<{ status?: TransactionStatus }> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { includePendingInBudget: true },
    });
    const includePending = settings?.includePendingInBudget ?? false;
    return includePending ? {} : { status: TransactionStatus.COMPLETED };
  }

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

  async createDefaultCategories(userId: string) {
    this.logger.log(`Creating default categories for user ${userId}`);

    type DefaultCat = {
      name: string;
      nameHe: string;
      icon: string;
      color: string;
      isIncome?: boolean;
      isFixed?: boolean;
      isSystem?: boolean;
      keywords: string[];
    };

    const defaultCategories: DefaultCat[] = [
      {
        name: 'salary',
        nameHe: 'משכורת',
        icon: '💰',
        color: '#22c55e',
        isIncome: true,
        isFixed: true,
        keywords: ['משכורת', 'שכר', 'salary'],
      },
      {
        name: 'bonus',
        nameHe: 'בונוס',
        icon: '🎁',
        color: '#10b981',
        isIncome: true,
        keywords: ['בונוס', 'פרמיה', 'bonus'],
      },
      {
        name: 'other_income',
        nameHe: 'הכנסה אחרת',
        icon: '💵',
        color: '#14b8a6',
        isIncome: true,
        keywords: ['החזר', 'זיכוי', 'refund'],
      },
      {
        name: 'rent',
        nameHe: 'שכר דירה',
        icon: '🏠',
        color: '#ef4444',
        isFixed: true,
        keywords: ['שכר דירה', 'שכירות', 'rent'],
      },
      {
        name: 'mortgage',
        nameHe: 'משכנתא',
        icon: '🏦',
        color: '#dc2626',
        isFixed: true,
        keywords: ['משכנתא', 'mortgage', 'פועלים-משכנתא'],
      },
      {
        name: 'electricity',
        nameHe: 'חשבון חשמל',
        icon: '⚡',
        color: '#f97316',
        isFixed: true,
        keywords: ['חשמל', 'חברת חשמל', 'IEC', 'electricity'],
      },
      {
        name: 'water',
        nameHe: 'חשבון מים',
        icon: '💧',
        color: '#0ea5e9',
        isFixed: true,
        keywords: ['מים', 'מי ', 'תאגיד מים', 'water'],
      },
      {
        name: 'vaad_bayit',
        nameHe: 'ועד בית',
        icon: '🏢',
        color: '#8b5cf6',
        isFixed: true,
        keywords: ['ועד בית', 'ועד הבית', 'דמי ועד'],
      },
      {
        name: 'arnona',
        nameHe: 'ארנונה',
        icon: '🏛️',
        color: '#ec4899',
        isFixed: true,
        keywords: ['ארנונה', 'עירייה', 'מועצה', 'arnona'],
      },
      {
        name: 'gas',
        nameHe: 'חשבון גז',
        icon: '🔥',
        color: '#f59e0b',
        isFixed: true,
        keywords: ['גז', 'פזגז', 'סופרגז', 'אמישראגז', 'gas'],
      },
      {
        name: 'internet',
        nameHe: 'אינטרנט וטלפון',
        icon: '📱',
        color: '#fb923c',
        isFixed: true,
        keywords: ['בזק', 'סלקום', 'פרטנר', 'הוט', 'cellcom', 'partner'],
      },
      {
        name: 'insurance',
        nameHe: 'ביטוח',
        icon: '🛡️',
        color: '#f59e0b',
        isFixed: true,
        keywords: ['ביטוח', 'הראל', 'מגדל', 'כלל', 'הפניקס', 'insurance'],
      },
      {
        name: 'groceries',
        nameHe: 'סופר ומכולת',
        icon: '🛒',
        color: '#84cc16',
        keywords: ['שופרסל', 'רמי לוי', 'יוחננוף', 'מגא', 'ויקטורי', 'סופר'],
      },
      {
        name: 'restaurants',
        nameHe: 'מסעדות וקפה',
        icon: '🍽️',
        color: '#a3e635',
        keywords: ['מסעדה', 'קפה', 'אוכל', 'פיצה', 'סושי', 'המבורגר'],
      },
      {
        name: 'transportation',
        nameHe: 'תחבורה',
        icon: '🚗',
        color: '#06b6d4',
        keywords: ['דלק', 'פז', 'סונול', 'דור אלון', 'רב קו', 'אגד', 'דן'],
      },
      {
        name: 'shopping',
        nameHe: 'קניות',
        icon: '🛍️',
        color: '#8b5cf6',
        keywords: ['עלי אקספרס', 'אמזון', 'איקאה', 'זארה', 'H&M', 'קניון'],
      },
      {
        name: 'health',
        nameHe: 'בריאות',
        icon: '🏥',
        color: '#ec4899',
        keywords: ['מכבי', 'כללית', 'מאוחדת', 'לאומית', 'בית מרקחת', 'סופר פארם'],
      },
      {
        name: 'entertainment',
        nameHe: 'בילויים',
        icon: '🎬',
        color: '#f472b6',
        keywords: ['סינמה', 'נטפליקס', 'ספוטיפי', 'הופעה', 'הצגה'],
      },
      {
        name: 'education',
        nameHe: 'חינוך',
        icon: '📚',
        color: '#a855f7',
        keywords: ['גן', 'בית ספר', 'קורס', 'לימודים', 'אוניברסיטה'],
      },
      {
        name: 'kids',
        nameHe: 'ילדים',
        icon: '👶',
        color: '#d946ef',
        keywords: ['צעצוע', 'חוג', 'ילדים'],
      },
      {
        name: 'pets',
        nameHe: 'חיות מחמד',
        icon: '🐕',
        color: '#c084fc',
        keywords: ['וטרינר', 'מזון לחיות', 'פט'],
      },
      {
        name: 'gifts',
        nameHe: 'מתנות',
        icon: '🎁',
        color: '#e879f9',
        keywords: ['מתנה', 'gift', 'יום הולדת'],
      },
      {
        name: 'travel',
        nameHe: 'נסיעות וחופשות',
        icon: '✈️',
        color: '#0ea5e9',
        keywords: ['טיסה', 'מלון', 'booking', 'airbnb'],
      },
      {
        name: 'fitness',
        nameHe: 'ספורט וכושר',
        icon: '🏃',
        color: '#38bdf8',
        keywords: ['חדר כושר', 'הולמס', 'פיטנס'],
      },
      {
        name: 'clothing',
        nameHe: 'ביגוד והנעלה',
        icon: '👕',
        color: '#7dd3fc',
        keywords: ['בגדים', 'נעליים', 'אופנה'],
      },
      {
        name: 'home',
        nameHe: 'בית וגינה',
        icon: '🏡',
        color: '#22d3ee',
        keywords: ['ריהוט', 'גינה', 'תיקון', 'שיפוץ'],
      },
      {
        name: 'electronics',
        nameHe: 'אלקטרוניקה',
        icon: '💻',
        color: '#2dd4bf',
        keywords: ['מחשב', 'טלפון', 'אלקטרוניקה', 'KSP', 'באג'],
      },
      {
        name: 'subscriptions',
        nameHe: 'מנויים',
        icon: '📺',
        color: '#34d399',
        keywords: ['מנוי', 'חודשי', 'subscription'],
      },
      {
        name: 'fees',
        nameHe: 'עמלות בנק',
        icon: '🏦',
        color: '#6b7280',
        keywords: ['עמלה', 'עמלות', 'דמי ניהול', 'fee'],
      },
      {
        name: 'interest',
        nameHe: 'ריבית',
        icon: '📈',
        color: '#9ca3af',
        keywords: ['ריבית', 'interest'],
      },
      {
        name: 'transfer',
        nameHe: 'העברות',
        icon: '🔄',
        color: '#d1d5db',
        keywords: ['העברה', 'bit', 'paybox', 'transfer'],
      },
      {
        name: 'cash',
        nameHe: 'מזומן',
        icon: '💵',
        color: '#fbbf24',
        keywords: ['משיכה', 'מזומן', 'כספומט', 'ATM'],
      },
      {
        name: 'credit_card',
        nameHe: 'אשראי',
        icon: '💳',
        color: '#94a3b8',
        keywords: ['ישראכרט', 'כרטיסי אשראי', 'מקס', 'ויזה כאל', 'לאומי קארד'],
      },
      {
        name: 'uncategorized',
        nameHe: 'לא מסווג',
        icon: '❓',
        color: '#64748b',
        isSystem: true,
        keywords: [],
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const cat of defaultCategories) {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: cat.name,
          OR: [{ userId }, { userId: null, isSystem: true }],
        },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const keywordsJson = cat.keywords as unknown as Prisma.InputJsonValue;

      await this.prisma.category.create({
        data: {
          userId,
          name: cat.name,
          nameHe: cat.nameHe,
          icon: cat.icon,
          color: cat.color,
          isIncome: cat.isIncome ?? false,
          isFixed: cat.isFixed ?? false,
          isSystem: cat.isSystem ?? false,
          isTracked: true,
          keywords: keywordsJson,
        },
      });
      created += 1;
    }

    this.logger.log(
      `Default categories: created ${created}, skipped ${skipped} existing`,
    );

    return {
      created,
      skipped,
      total: defaultCategories.length,
    };
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
        ...(dto.monthlyTarget !== undefined
          ? {
              monthlyTarget:
                dto.monthlyTarget === null
                  ? null
                  : new Prisma.Decimal(dto.monthlyTarget),
            }
          : {}),
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
    if (dto.monthlyTarget !== undefined) {
      data.monthlyTarget =
        dto.monthlyTarget === null
          ? null
          : new Prisma.Decimal(dto.monthlyTarget);
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
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { budgetCycleStartDay: true, includePendingInBudget: true },
    });
    const cycleStartDay = settings?.budgetCycleStartDay ?? 1;
    const includePendingBudget = settings?.includePendingInBudget ?? false;
    const budgetStatusWhere = includePendingBudget
      ? {}
      : { status: TransactionStatus.COMPLETED };

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
      const i = getBudgetCycleLabelForIsraelDate(now, cycleStartDay);
      targetMonth = i.month;
      targetYear = i.year;
    }

    this.logger.log(
      `getCategoriesWithStats: budget cycle label ${targetMonth}/${targetYear} (startDay=${cycleStartDay})`,
    );

    const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
      targetYear,
      targetMonth,
      cycleStartDay,
    );

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

    const statsMap = new Map<
      string,
      {
        incomeCount: number;
        expenseCount: number;
        incomeSum: number;
        expenseSum: number;
      }
    >();

    if (accountIds.length > 0) {
      const transactionsRaw = await this.prisma.transaction.findMany({
        where: {
          accountId: { in: accountIds },
          isExcludedFromCashFlow: false,
          ...budgetStatusWhere,
          OR: [
            { date: { gte: rangeStart, lte: rangeEnd } },
            { effectiveDate: { gte: rangeStart, lte: rangeEnd } },
          ],
        },
        include: { category: true },
      });

      const transactions = transactionsRaw.filter((t) =>
        isInBudgetCycle(
          cashFlowAnchorDate(t),
          targetYear,
          targetMonth,
          cycleStartDay,
        ),
      );

      for (const txn of transactions) {
        const catId = txn.categoryId ?? uncategorizedId;
        if (!catId) continue;
        const current = statsMap.get(catId) || {
          incomeCount: 0,
          expenseCount: 0,
          incomeSum: 0,
          expenseSum: 0,
        };
        const amt = Number(txn.amount);
        const isIncomeCategory = txn.category?.isIncome === true;
        if (amt > 0 || isIncomeCategory) {
          current.incomeSum += Math.abs(amt);
          current.incomeCount += 1;
        } else if (amt < 0 && !isIncomeCategory) {
          current.expenseSum += Math.abs(amt);
          current.expenseCount += 1;
        }
        statsMap.set(catId, current);
      }
    }

    const result = categories.map((cat) => {
      const stats = statsMap.get(cat.id) || {
        incomeCount: 0,
        expenseCount: 0,
        incomeSum: 0,
        expenseSum: 0,
      };
      const totalAmount = cat.isIncome ? stats.incomeSum : stats.expenseSum;
      const spent = stats.expenseSum;
      const target =
        cat.monthlyTarget != null ? Number(cat.monthlyTarget) : null;
      const remaining =
        target !== null ? Math.round((target - spent) * 100) / 100 : null;
      const percentUsed =
        target !== null && target > 0
          ? Math.round((spent / target) * 100)
          : null;
      const isOverBudget = remaining !== null && remaining < 0;

      const txnCount = cat.isIncome ? stats.incomeCount : stats.expenseCount;

      return {
        ...cat,
        monthlyTarget: target,
        spent: Math.round(spent * 100) / 100,
        income: Math.round(stats.incomeSum * 100) / 100,
        remaining,
        percentUsed,
        isOverBudget,
        transactionCount: txnCount,
        totalAmount: Math.round(totalAmount * 100) / 100,
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
