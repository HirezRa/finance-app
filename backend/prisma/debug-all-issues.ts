import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('DEBUG: Full System Analysis');
  console.log('='.repeat(60));

  console.log('\n>>> ISSUE 1: Duplicate Transactions <<<\n');

  const allTxns = await prisma.transaction.findMany({
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      scraperHash: true,
      accountId: true,
    },
    orderBy: { date: 'desc' },
  });

  console.log(`Total transactions: ${allTxns.length}`);

  const hashCount = new Map<string, number>();
  for (const txn of allTxns) {
    if (txn.scraperHash) {
      hashCount.set(txn.scraperHash, (hashCount.get(txn.scraperHash) || 0) + 1);
    }
  }

  const duplicateHashes = Array.from(hashCount.entries()).filter(([, count]) => count > 1);
  console.log(`Duplicate hashes: ${duplicateHashes.length}`);

  if (duplicateHashes.length > 0) {
    console.log('First 5 duplicates:');
    duplicateHashes.slice(0, 5).forEach(([hash, count]) => {
      const txns = allTxns.filter((t) => t.scraperHash === hash);
      console.log(`  Hash: ${hash.substring(0, 16)}... (${count} times)`);
      txns.forEach((t) =>
        console.log(`    - ID: ${t.id}, ${t.description?.substring(0, 30)}, ${t.amount}`),
      );
    });
  }

  const contentKey = (t: {
    accountId: string;
    date: Date;
    amount: unknown;
    description: string | null;
  }) =>
    `${t.accountId}|${t.date.toISOString().split('T')[0]}|${t.amount}|${t.description ?? ''}`;
  const contentCount = new Map<string, string[]>();
  for (const txn of allTxns) {
    const key = contentKey(txn);
    if (!contentCount.has(key)) {
      contentCount.set(key, []);
    }
    contentCount.get(key)!.push(txn.id);
  }

  const contentDuplicates = Array.from(contentCount.entries()).filter(([, ids]) => ids.length > 1);
  console.log(`\nContent duplicates (same account+date+amount+description): ${contentDuplicates.length}`);

  if (contentDuplicates.length > 0) {
    console.log('First 5 content duplicates:');
    contentDuplicates.slice(0, 5).forEach(([key, ids]) => {
      console.log(`  Key: ${key.substring(0, 80)}...`);
      console.log(`  IDs: ${ids.join(', ')}`);
    });
  }

  console.log('\n>>> ISSUE 2: Budget Spending <<<\n');

  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found!');
    return;
  }
  console.log(`User: ${user.email} (${user.id})`);

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true, institutionName: true, balance: true },
  });
  console.log(`\nAccounts: ${accounts.length}`);
  accounts.forEach((a) => console.log(`  - ${a.institutionName}: balance=${a.balance}`));

  const accountIds = accounts.map((a) => a.id);

  const budgets = await prisma.budget.findMany({
    where: { userId: user.id },
    include: {
      categories: {
        include: { category: true },
      },
    },
  });

  console.log(`\nBudgets: ${budgets.length}`);
  for (const budget of budgets) {
    console.log(`\n  Budget for ${budget.month}/${budget.year}:`);
    console.log(`  Categories: ${budget.categories.length}`);

    const startDate = new Date(budget.year, budget.month - 1, 1);
    const endDate = new Date(budget.year, budget.month, 0, 23, 59, 59, 999);

    console.log(`  Date range (server local): ${startDate.toISOString()} - ${endDate.toISOString()}`);

    const txnsInMonth = await prisma.transaction.findMany({
      where: {
        accountId: { in: accountIds },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
      },
      select: { categoryId: true, amount: true, description: true },
    });

    console.log(`  Expense transactions in month (local range): ${txnsInMonth.length}`);

    const spendingByCategory = new Map<string | null, number>();
    for (const txn of txnsInMonth) {
      const catId = txn.categoryId;
      spendingByCategory.set(catId, (spendingByCategory.get(catId) || 0) + Math.abs(Number(txn.amount)));
    }

    console.log(`\n  Spending by categoryId:`);
    spendingByCategory.forEach((amount, catId) => {
      console.log(`    ${catId || 'null (uncategorized)'}: ${amount.toFixed(2)}`);
    });

    console.log(`\n  Budget categories vs spending:`);
    for (const bc of budget.categories) {
      const spent = spendingByCategory.get(bc.categoryId) || 0;
      console.log(`    ${bc.category.nameHe}: budget=${bc.amount}, spent=${spent.toFixed(2)}`);
    }
  }

  console.log('\n>>> Checking categoryId validity <<<');

  const categories = await prisma.category.findMany({
    select: { id: true, nameHe: true },
  });
  const categoryIds = new Set(categories.map((c) => c.id));

  const txnsWithCategory = await prisma.transaction.findMany({
    where: { categoryId: { not: null } },
    select: { id: true, categoryId: true, description: true },
  });

  const invalidCategoryTxns = txnsWithCategory.filter((t) => !categoryIds.has(t.categoryId!));
  console.log(`Transactions with invalid categoryId: ${invalidCategoryTxns.length}`);

  console.log('\n>>> ISSUE 3: Account Balance <<<\n');

  for (const account of accounts) {
    const fullAccount = await prisma.account.findUnique({
      where: { id: account.id },
    });
    console.log(`Account: ${fullAccount?.institutionName}`);
    console.log(`  balance field: ${fullAccount?.balance}`);
    console.log(`  balance type: ${typeof fullAccount?.balance}`);
    console.log(`  balance as number: ${Number(fullAccount?.balance)}`);

    const scraperConfig = await prisma.scraperConfig.findFirst({
      where: { userId: user.id },
    });
    if (scraperConfig) {
      console.log(`  ScraperConfig exists: yes`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total transactions: ${allTxns.length}`);
  console.log(`Hash duplicates: ${duplicateHashes.length}`);
  console.log(`Content duplicates: ${contentDuplicates.length}`);
  console.log(`Budgets: ${budgets.length}`);
  console.log(`Accounts: ${accounts.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
