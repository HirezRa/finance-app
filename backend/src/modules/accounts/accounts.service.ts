import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, includeInactive = false) {
    const rows = await this.prisma.account.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [
        { isActive: 'desc' },
        { institutionName: 'asc' },
        { accountNumber: 'asc' },
      ],
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
    return rows.map((a) => ({
      ...a,
      balance: Number(a.balance) || 0,
    }));
  }

  async findOne(id: string, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('חשבון לא נמצא');
    }

    return {
      ...account,
      balance: Number(account.balance) || 0,
    };
  }

  async update(
    id: string,
    userId: string,
    data: {
      nickname?: string | null;
      description?: string | null;
      isActive?: boolean;
    },
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException('חשבון לא נמצא');
    }

    const patch: Prisma.AccountUpdateInput = {};
    if (data.nickname !== undefined) {
      patch.nickname = data.nickname;
    }
    if (data.description !== undefined) {
      patch.description = data.description;
    }
    if (data.isActive !== undefined) {
      patch.isActive = data.isActive;
    }

    return this.prisma.account.update({
      where: { id },
      data: patch,
    });
  }

  async delete(id: string, userId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException('חשבון לא נמצא');
    }

    await this.prisma.transaction.deleteMany({
      where: { accountId: id },
    });

    return this.prisma.account.delete({
      where: { id },
    });
  }

  async getAccountSummary(id: string, userId: string) {
    const account = await this.findOne(id, userId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthlyIncome, monthlyExpenses] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          accountId: id,
          date: { gte: startOfMonth },
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          accountId: id,
          date: { gte: startOfMonth },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      ...account,
      balance: Number(account.balance) || 0,
      monthlyIncome: Number(monthlyIncome._sum.amount) || 0,
      monthlyExpenses: Math.abs(Number(monthlyExpenses._sum.amount)) || 0,
    };
  }
}
