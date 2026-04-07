import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Same logic as src/common/utils/israel-calendar (inlined so this runs in Docker without src/). */
function getIsraelYearMonth(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(d);

  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  return { year: y, month: m };
}

function parseKeywordsField(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
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

async function fixDuplicates() {
  console.log('\n=== Step 1: Fixing Duplicate Transactions ===\n');

  const txns = await prisma.transaction.findMany({
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      accountId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Total transactions before: ${txns.length}`);

  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const t of txns) {
    const dateStr = t.date.toISOString().split('T')[0];
    const amountStr = Number(t.amount).toFixed(2);
    const key = `${t.accountId}|${dateStr}|${amountStr}|${(t.description || '').trim()}`;

    if (seen.has(key)) {
      duplicateIds.push(t.id);
    } else {
      seen.set(key, t.id);
    }
  }

  console.log(`Duplicates found: ${duplicateIds.length}`);

  if (duplicateIds.length > 0) {
    const deleted = await prisma.transaction.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`Deleted: ${deleted.count} duplicates`);
  }

  const remaining = await prisma.transaction.count();
  console.log(`Total transactions after: ${remaining}`);
}

async function recategorizeTransactions() {
  console.log('\n=== Step 2: Recategorizing Transactions ===\n');

  const categories = await prisma.category.findMany({
    select: { id: true, nameHe: true, keywords: true, isIncome: true },
  });

  console.log(`Categories: ${categories.length}`);

  const keywordMap: { keyword: string; categoryId: string; isIncome: boolean }[] = [];

  for (const cat of categories) {
    const keywords = parseKeywordsField(cat.keywords);
    for (const kw of keywords) {
      const trimmed = kw.toLowerCase().trim();
      if (trimmed) {
        keywordMap.push({
          keyword: trimmed,
          categoryId: cat.id,
          isIncome: cat.isIncome,
        });
      }
    }
  }

  console.log(`Total keyword entries: ${keywordMap.length}`);

  const transactions = await prisma.transaction.findMany({
    select: { id: true, description: true, categoryId: true },
  });

  let updated = 0;
  let alreadyCategorized = 0;

  for (const txn of transactions) {
    const desc = (txn.description || '').toLowerCase();

    for (const { keyword, categoryId } of keywordMap) {
      if (desc.includes(keyword)) {
        if (txn.categoryId !== categoryId) {
          await prisma.transaction.update({
            where: { id: txn.id },
            data: { categoryId },
          });
          updated++;
        } else {
          alreadyCategorized++;
        }
        break;
      }
    }
  }

  console.log(`Updated: ${updated}`);
  console.log(`Already matched current category: ${alreadyCategorized}`);

  const uncategorized = await prisma.transaction.count({ where: { categoryId: null } });
  console.log(`Still uncategorized: ${uncategorized}`);
}

async function checkBudgetData() {
  console.log('\n=== Step 3: Checking Budget Data ===\n');

  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found!');
    return;
  }

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  const accountIds = accounts.map((a) => a.id);

  const txns = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds } },
    select: { date: true, amount: true, categoryId: true },
  });

  const byMonth: Record<string, { income: number; expenses: number; count: number }> = {};

  for (const t of txns) {
    const { year, month } = getIsraelYearMonth(t.date);
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { income: 0, expenses: 0, count: 0 };
    }

    const amount = Number(t.amount);
    byMonth[monthKey].count++;

    if (amount > 0) {
      byMonth[monthKey].income += amount;
    } else {
      byMonth[monthKey].expenses += Math.abs(amount);
    }
  }

  console.log('Transactions by month (Asia/Jerusalem):');
  Object.entries(byMonth)
    .sort()
    .forEach(([mk, data]) => {
      console.log(
        `  ${mk}: ${data.count} txns, income: ${data.income.toFixed(0)}, expenses: ${data.expenses.toFixed(0)}`,
      );
    });

  const budgets = await prisma.budget.findMany({
    where: { userId: user.id },
    include: { categories: { include: { category: true } } },
  });

  console.log(`\nBudgets: ${budgets.length}`);
  for (const b of budgets) {
    console.log(`  ${b.month}/${b.year}: ${b.categories.length} categories`);
  }
}

async function main() {
  try {
    await fixDuplicates();
    await recategorizeTransactions();
    await checkBudgetData();
    console.log('\n=== Done! ===\n');
  } catch (error) {
    console.error('Error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
