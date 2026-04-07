import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DEBUG: Transactions Analysis ===\n');

  const totalCount = await prisma.transaction.count();
  console.log(`Total transactions in DB: ${totalCount}`);

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  console.log(`\nUsers: ${users.length}`);
  users.forEach((u) => console.log(`  - ${u.email} (${u.id})`));

  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      userId: true,
      institutionName: true,
      _count: { select: { transactions: true } },
    },
  });
  console.log(`\nAccounts: ${accounts.length}`);
  accounts.forEach((a) =>
    console.log(`  - ${a.institutionName}: ${a._count.transactions} txns, userId: ${a.userId}`),
  );

  const dateRange = await prisma.transaction.aggregate({
    _min: { date: true },
    _max: { date: true },
  });
  console.log(`\nTransaction date range:`);
  console.log(`  Min: ${dateRange._min.date?.toISOString()}`);
  console.log(`  Max: ${dateRange._max.date?.toISOString()}`);

  const transactions = await prisma.transaction.findMany({
    select: { date: true, amount: true },
  });

  const byMonth: Record<string, { count: number; income: number; expenses: number }> = {};

  for (const txn of transactions) {
    const monthKey = `${txn.date.getFullYear()}-${String(txn.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { count: 0, income: 0, expenses: 0 };
    }
    byMonth[monthKey].count++;
    const amount = Number(txn.amount);
    if (amount > 0) {
      byMonth[monthKey].income += amount;
    } else {
      byMonth[monthKey].expenses += Math.abs(amount);
    }
  }

  console.log(`\nTransactions by month:`);
  Object.entries(byMonth)
    .sort()
    .forEach(([month, data]) => {
      console.log(
        `  ${month}: ${data.count} txns, income: ${data.income.toFixed(0)}, expenses: ${data.expenses.toFixed(0)}`,
      );
    });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  console.log(`\n=== Current month: ${currentMonth}/${currentYear} ===`);

  const startUTC = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0, 0));
  const endUTC = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

  const startLocal = new Date(currentYear, currentMonth - 1, 1);
  const endLocal = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

  console.log(`\nUTC range: ${startUTC.toISOString()} - ${endUTC.toISOString()}`);
  console.log(`Local range: ${startLocal.toISOString()} - ${endLocal.toISOString()}`);

  const countUTC = await prisma.transaction.count({
    where: {
      date: { gte: startUTC, lte: endUTC },
    },
  });

  const countLocal = await prisma.transaction.count({
    where: {
      date: { gte: startLocal, lte: endLocal },
    },
  });

  console.log(`\nTransactions in current month (UTC): ${countUTC}`);
  console.log(`Transactions in current month (Local): ${countLocal}`);

  const recent = await prisma.transaction.findMany({
    take: 10,
    orderBy: { date: 'desc' },
    select: {
      date: true,
      amount: true,
      description: true,
      categoryId: true,
      account: { select: { userId: true } },
    },
  });

  console.log(`\nLast 10 transactions:`);
  recent.forEach((t) => {
    console.log(
      `  ${t.date.toISOString()} | ${Number(t.amount).toFixed(2)} | ${t.description?.substring(0, 30)} | userId: ${t.account?.userId}`,
    );
  });

  const budgets = await prisma.budget.findMany({
    include: {
      categories: true,
    },
  });

  console.log(`\nBudgets: ${budgets.length}`);
  budgets.forEach((b) => {
    console.log(`  ${b.month}/${b.year} - userId: ${b.userId}, categories: ${b.categories.length}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
