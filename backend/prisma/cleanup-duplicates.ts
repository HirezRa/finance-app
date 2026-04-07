import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Calendar day in Asia/Jerusalem (matches local bank day, avoids UTC shift). */
function dayKeyJerusalem(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

async function main() {
  console.log('Finding duplicate transactions...');

  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      accountId: true,
      date: true,
      amount: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const txn of transactions) {
    const day = dayKeyJerusalem(txn.date);
    const key = [
      txn.accountId,
      day,
      txn.amount.toString(),
      txn.description,
    ].join('|');

    if (seen.has(key)) {
      duplicateIds.push(txn.id);
    } else {
      seen.set(key, txn.id);
    }
  }

  console.log(`Found ${duplicateIds.length} duplicate transactions`);

  if (duplicateIds.length > 0) {
    const deleted = await prisma.transaction.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    console.log(`Deleted ${deleted.count} duplicate transactions`);
  }

  const remaining = await prisma.transaction.count();
  console.log(`Remaining transactions: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
