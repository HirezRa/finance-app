import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing duplicate transactions...\n');

  const allTxns = await prisma.transaction.findMany({
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

  console.log(`Total transactions before: ${allTxns.length}`);

  const contentKey = (t: {
    accountId: string;
    date: Date;
    amount: unknown;
    description: string;
  }) => {
    const dateStr = t.date.toISOString().split('T')[0];
    return `${t.accountId}|${dateStr}|${Number(t.amount).toFixed(2)}|${t.description || ''}`;
  };

  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const txn of allTxns) {
    const key = contentKey(txn);
    if (seen.has(key)) {
      duplicateIds.push(txn.id);
    } else {
      seen.set(key, txn.id);
    }
  }

  console.log(`Duplicates found: ${duplicateIds.length}`);

  if (duplicateIds.length > 0) {
    const deleted = await prisma.transaction.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`Deleted: ${deleted.count} duplicate transactions`);
  }

  const remaining = await prisma.transaction.count();
  console.log(`Total transactions after: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
