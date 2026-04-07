import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DEBUG: Dashboard API Simulation ===\n');

  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found!');
    return;
  }

  console.log(`Testing for user: ${user.email} (${user.id})`);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  console.log(`\nMonth: ${month}/${year}`);
  console.log(`Start: ${startDate.toISOString()}`);
  console.log(`End: ${endDate.toISOString()}`);

  const txnsByAccountUser = await prisma.transaction.findMany({
    where: {
      account: { userId: user.id },
      date: { gte: startDate, lte: endDate },
      isExcludedFromCashFlow: false,
    },
    include: { category: true, account: true },
  });

  console.log(`\nTransactions by account.userId: ${txnsByAccountUser.length}`);

  const txnsNoDateFilter = await prisma.transaction.findMany({
    where: {
      account: { userId: user.id },
      isExcludedFromCashFlow: false,
    },
    include: { account: true },
    take: 5,
  });

  console.log(`Transactions by account.userId (no date filter): ${txnsNoDateFilter.length} (showing 5)`);
  txnsNoDateFilter.forEach((t) => {
    console.log(`  ${t.date.toISOString()} | ${t.amount}`);
  });

  const userAccounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, institutionName: true },
  });

  console.log(`\nUser accounts: ${userAccounts.length}`);
  userAccounts.forEach((a) => console.log(`  - ${a.id}: ${a.institutionName}`));

  if (userAccounts.length > 0) {
    const accountIds = userAccounts.map((a) => a.id);
    const txnsByAccountId = await prisma.transaction.count({
      where: {
        accountId: { in: accountIds },
        date: { gte: startDate, lte: endDate },
      },
    });
    console.log(`\nTransactions by accountId IN [...]: ${txnsByAccountId}`);
  }

  const excludedCount = await prisma.transaction.count({
    where: {
      account: { userId: user.id },
      isExcludedFromCashFlow: true,
    },
  });
  console.log(`\nExcluded from cash flow: ${excludedCount}`);

  let income = 0;
  let expenses = 0;

  for (const txn of txnsByAccountUser) {
    const amount = Number(txn.amount);
    if (amount > 0) {
      income += amount;
    } else {
      expenses += Math.abs(amount);
    }
  }

  const startLocal = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endLocal = new Date(year, month, 0, 23, 59, 59, 999);

  const txnsLocalRange = await prisma.transaction.count({
    where: {
      account: { userId: user.id },
      date: { gte: startLocal, lte: endLocal },
      isExcludedFromCashFlow: false,
    },
  });
  console.log(`\nSame user, LOCAL date range: ${startLocal.toISOString()} - ${endLocal.toISOString()}`);
  console.log(`Transactions (local range): ${txnsLocalRange}`);

  console.log(`\n=== CALCULATED SUMMARY (UTC month) ===`);
  console.log(`Income: ${income.toFixed(2)}`);
  console.log(`Expenses: ${expenses.toFixed(2)}`);
  console.log(`Remaining: ${(income - expenses).toFixed(2)}`);
  console.log(`Transaction count: ${txnsByAccountUser.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
