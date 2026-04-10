import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  TransactionStatus,
  TransactionType,
  AccountType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { computeSalaryEffectiveDateForBankDate } from '../../common/utils/salary-effective-date';
import {
  withDefaultTransactionCategory,
  uncategorizedTransactionFilter,
} from '../../common/utils/transaction-category-default';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, query: GetTransactionsDto) {
    const {
      accountId,
      categoryId,
      startDate,
      endDate,
      search,
      status: statusQ,
      type: typeQ,
      hasInstallments,
      accountTypes: accountTypesQ,
      page = 1,
      limit = 50,
    } = query;

    let accountTypes: AccountType[] = [AccountType.BANK, AccountType.CREDIT_CARD];
    if (accountTypesQ !== undefined) {
      if (accountTypesQ.length === 0) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      accountTypes = accountTypesQ;
    }

    const where: Prisma.TransactionWhereInput = {
      account: {
        userId,
        accountType: { in: accountTypes },
        ...(accountId ? { id: accountId } : {}),
      },
    };

    // When credit accounts are not selected, hide aggregate credit-card charges
    // that appear on bank statements (marked isExcludedFromCashFlow).
    if (!accountTypes.includes(AccountType.CREDIT_CARD)) {
      where.isExcludedFromCashFlow = false;
    }

    if (categoryId?.toLowerCase() === 'uncategorized') {
      const uncWhere = await uncategorizedTransactionFilter(
        this.prisma,
        userId,
      );
      const existingAnd = where.AND;
      where.AND = [
        ...(Array.isArray(existingAnd)
          ? existingAnd
          : existingAnd
            ? [existingAnd]
            : []),
        uncWhere,
      ];
    } else if (categoryId) {
      where.categoryId = categoryId;
    }

    const st = statusQ ?? 'all';
    if (st === 'pending') {
      where.status = TransactionStatus.PENDING;
    } else if (st === 'completed') {
      where.status = TransactionStatus.COMPLETED;
    }

    if (typeQ && typeQ !== 'all') {
      where.type = typeQ as TransactionType;
    }

    if (hasInstallments) {
      where.installmentTotal = { gt: 1 };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { note: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              institutionName: true,
              accountNumber: true,
              nickname: true,
              description: true,
            },
          },
          category: {
            select: { id: true, name: true, nameHe: true, icon: true, color: true },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((tx) => withDefaultTransactionCategory(tx)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleExcludeFromCashFlow(id: string, userId: string, exclude: boolean) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, account: { userId } },
    });

    if (!transaction) {
      throw new NotFoundException('עסקה לא נמצאה');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { isExcludedFromCashFlow: exclude },
      include: {
        category: true,
        account: {
          select: {
            id: true,
            institutionName: true,
            accountNumber: true,
            nickname: true,
            description: true,
          },
        },
      },
    });
  }

  async updateNote(id: string, userId: string, note: string | null) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, account: { userId } },
    });

    if (!transaction) {
      throw new NotFoundException('עסקה לא נמצאה');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { note },
      include: {
        category: true,
        account: {
          select: {
            id: true,
            institutionName: true,
            accountNumber: true,
            nickname: true,
            description: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id,
        account: { userId },
      },
      include: {
        account: true,
        category: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('עסקה לא נמצאה');
    }

    return transaction;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    let accountId = dto.accountId;

    if (accountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: accountId, userId },
      });
      if (!acc) {
        throw new NotFoundException('חשבון לא נמצא');
      }
    } else {
      let manualAccount = await this.prisma.account.findFirst({
        where: { userId, institutionId: 'manual' },
      });

      if (!manualAccount) {
        manualAccount = await this.prisma.account.create({
          data: {
            userId,
            institutionId: 'manual',
            institutionName: 'ידני',
            accountNumber: 'manual',
            accountType: 'BANK',
          },
        });
      }

      accountId = manualAccount.id;
    }

    if (dto.categoryId) {
      await this.ensureCategoryVisible(dto.categoryId, userId);
    }

    const scraperHash = `manual-${randomUUID()}`;
    const txnDate = new Date(dto.date);
    const effectiveDate = await this.resolveEffectiveDate(
      userId,
      txnDate,
      dto.categoryId ?? null,
    );

    return this.prisma.transaction.create({
      data: {
        accountId: accountId!,
        date: txnDate,
        effectiveDate,
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description,
        categoryId: dto.categoryId ?? null,
        notes: dto.notes ?? null,
        isManual: true,
        createdByUserId: userId,
        type: 'NORMAL',
        status: 'COMPLETED',
        scraperHash,
      },
      include: {
        category: true,
        account: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto) {
    const current = await this.findOne(id, userId);

    const data: Prisma.TransactionUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.isExcludedFromCashFlow !== undefined) {
      data.isExcludedFromCashFlow = dto.isExcludedFromCashFlow;
    }
    if (dto.categoryId !== undefined) {
      if (!dto.categoryId) {
        data.category = { disconnect: true };
        data.effectiveDate = null;
      } else {
        await this.ensureCategoryVisible(dto.categoryId, userId);
        data.category = { connect: { id: dto.categoryId } };
        data.effectiveDate = await this.resolveEffectiveDate(
          userId,
          current.date,
          dto.categoryId,
        );
      }
    }

    return this.prisma.transaction.update({
      where: { id },
      data,
      include: {
        category: true,
        account: true,
      },
    });
  }

  async delete(id: string, userId: string) {
    const transaction = await this.findOne(id, userId);

    if (!transaction.isManual) {
      throw new BadRequestException('לא ניתן למחוק עסקאות שהתקבלו מהבנק');
    }

    return this.prisma.transaction.delete({
      where: { id },
    });
  }

  async deleteAllTransactions(userId: string) {
    this.logger.log('=== DELETE ALL TRANSACTIONS ===');
    this.logger.log(`Received userId: "${userId}"`);
    this.logger.log(`userId type: ${typeof userId}`);

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { id: true, userId: true, institutionName: true },
    });

    this.logger.log(`Found ${accounts.length} accounts for userId "${userId}"`);
    accounts.forEach((a) => {
      this.logger.log(
        `  Account: ${a.id} (${a.institutionName}), userId: ${a.userId}`,
      );
    });

    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      this.logger.log('No accounts found - checking if user exists...');

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (user) {
        this.logger.log(`User exists: ${user.email}`);

        const allAccounts = await this.prisma.account.findMany({
          select: { id: true, userId: true, institutionName: true },
        });
        this.logger.log(`Total accounts in DB: ${allAccounts.length}`);
        allAccounts.forEach((a) => {
          this.logger.log(`  DB Account: ${a.id}, userId: "${a.userId}"`);
        });
      } else {
        this.logger.log(`User NOT found with id: ${userId}`);
      }

      return { deleted: 0 };
    }

    const countBefore = await this.prisma.transaction.count({
      where: { accountId: { in: accountIds } },
    });

    this.logger.log(`Found ${countBefore} transactions to delete`);

    const result = await this.prisma.transaction.deleteMany({
      where: {
        accountId: { in: accountIds },
      },
    });

    this.logger.log(`=== DELETED ${result.count} transactions ===`);

    return { deleted: result.count };
  }

  private parseKeywordsField(
    raw: Prisma.JsonValue | null | undefined,
  ): string[] {
    if (raw === null || raw === undefined) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    }
    if (typeof raw === 'string') {
      return raw.trim() ? [raw] : [];
    }
    if (typeof raw === 'object') {
      return Object.values(raw as Record<string, unknown>).filter(
        (v): v is string => typeof v === 'string' && v.trim() !== '',
      );
    }
    return [];
  }

  async recategorizeAll(userId: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { userId: null, isSystem: true }],
      },
      select: {
        id: true,
        keywords: true,
        nameHe: true,
      },
    });

    const keywordMap: Array<{
      keyword: string;
      categoryId: string;
      categoryName: string;
    }> = [];

    for (const cat of categories) {
      const keywordsArray = this.parseKeywordsField(cat.keywords);
      for (const kw of keywordsArray) {
        keywordMap.push({
          keyword: kw.toLowerCase(),
          categoryId: cat.id,
          categoryName: cat.nameHe,
        });
      }
    }

    this.logger.log(
      `recategorizeAll: ${keywordMap.length} keywords from ${categories.length} categories`,
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
      },
      select: {
        id: true,
        description: true,
        categoryId: true,
        date: true,
      },
    });

    let categorizedCount = 0;
    let alreadyCategorizedCount = 0;

    for (const txn of transactions) {
      const descLower = (txn.description || '').toLowerCase();

      for (const { keyword, categoryId } of keywordMap) {
        if (descLower.includes(keyword)) {
          if (txn.categoryId !== categoryId) {
            const effectiveDate = await this.resolveEffectiveDate(
              userId,
              txn.date,
              categoryId,
            );
            await this.prisma.transaction.update({
              where: { id: txn.id },
              data: { categoryId, effectiveDate },
            });
            categorizedCount++;
          } else {
            alreadyCategorizedCount++;
          }
          break;
        }
      }
    }

    return {
      message: `סווגו ${categorizedCount} עסקאות, ${alreadyCategorizedCount} כבר מסווגות`,
      categorized: categorizedCount,
      alreadyCategorized: alreadyCategorizedCount,
      total: transactions.length,
    };
  }

  async bulkUpdateCategory(
    userId: string,
    transactionIds: string[],
    categoryId: string,
  ) {
    await this.ensureCategoryVisible(categoryId, userId);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        id: { in: transactionIds },
        account: { userId },
      },
      select: { id: true, date: true },
    });

    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('חלק מהעסקאות לא נמצאו');
    }

    for (const t of transactions) {
      const effectiveDate = await this.resolveEffectiveDate(userId, t.date, categoryId);
      await this.prisma.transaction.update({
        where: { id: t.id },
        data: { categoryId, effectiveDate },
      });
    }

    return { count: transactions.length };
  }

  async getInstallmentsSummary(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        activeCount: 0,
        totalMonthly: 0,
        totalRemaining: 0,
        details: [] as Array<{
          description: string;
          monthlyAmount: number;
          currentPayment: number | null;
          totalPayments: number | null;
          remainingPayments: number;
          totalPaid: number;
          remainingAmount: number;
        }>,
      };
    }

    const activeInstallments = await this.prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        type: TransactionType.INSTALLMENTS,
        installmentTotal: { gt: 1 },
        status: TransactionStatus.COMPLETED,
      },
      select: {
        id: true,
        description: true,
        amount: true,
        installmentNumber: true,
        installmentTotal: true,
        date: true,
      },
      orderBy: { date: 'desc' },
    });

    const grouped = new Map<string, typeof activeInstallments>();
    for (const txn of activeInstallments) {
      const key = (txn.description || '').trim().slice(0, 30) || txn.id;
      const list = grouped.get(key);
      if (list) list.push(txn);
      else grouped.set(key, [txn]);
    }

    const details = Array.from(grouped.entries()).map(([, txns]) => {
      const sorted = [...txns].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
      );
      const latest = sorted[0];
      const totalPaid = sorted.reduce(
        (sum, t) => sum + Math.abs(Number(t.amount)),
        0,
      );
      const monthlyAmount = Math.abs(Number(latest.amount));
      const totalP = latest.installmentTotal ?? 0;
      const curN = latest.installmentNumber ?? 0;
      const remainingPayments = Math.max(0, totalP - curN);
      const remainingAmount = remainingPayments * monthlyAmount;

      return {
        description: (latest.description || '').trim().slice(0, 40) || '—',
        monthlyAmount,
        currentPayment: latest.installmentNumber,
        totalPayments: latest.installmentTotal,
        remainingPayments,
        totalPaid,
        remainingAmount,
      };
    });

    return {
      activeCount: details.length,
      totalMonthly: details.reduce((s, d) => s + d.monthlyAmount, 0),
      totalRemaining: details.reduce((s, d) => s + d.remainingAmount, 0),
      details,
    };
  }

  private async resolveEffectiveDate(
    userId: string,
    bankDate: Date,
    categoryId: string | null,
  ): Promise<Date | null> {
    if (!categoryId) {
      return null;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { isIncome: true },
    });

    if (!category?.isIncome) {
      return null;
    }

    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { salaryStartDay: true, salaryEndDay: true },
    });

    return computeSalaryEffectiveDateForBankDate(
      bankDate,
      true,
      settings?.salaryStartDay ?? 25,
      settings?.salaryEndDay ?? 31,
    );
  }

  private async ensureCategoryVisible(categoryId: string, userId: string) {
    const cat = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId }, { isSystem: true }],
      },
    });
    if (!cat) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }
  }
}
