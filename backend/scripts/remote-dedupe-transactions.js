/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Deleting Duplicates ===');

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

  console.log('Total before:', txns.length);

  const seen = new Map();
  const dupeIds = [];

  for (const t of txns) {
    const dateStr = t.date.toISOString().split('T')[0];
    const key = `${t.accountId}|${dateStr}|${Number(t.amount).toFixed(2)}|${(t.description || '').trim()}`;
    if (seen.has(key)) dupeIds.push(t.id);
    else seen.set(key, t.id);
  }

  console.log('Duplicates found:', dupeIds.length);

  if (dupeIds.length > 0) {
    const del = await prisma.transaction.deleteMany({ where: { id: { in: dupeIds } } });
    console.log('Deleted:', del.count);
  }

  console.log('Total after:', await prisma.transaction.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
