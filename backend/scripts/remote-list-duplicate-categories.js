/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, nameHe: true, isSystem: true, userId: true },
    orderBy: { nameHe: 'asc' },
  });

  console.log('=== All Categories ===');
  console.log('Total:', categories.length);

  const byName = new Map();
  for (const c of categories) {
    const key = c.nameHe;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(c);
  }

  console.log('\n=== Duplicates (same nameHe) ===');
  let anyDup = false;
  for (const [name, cats] of byName) {
    if (cats.length > 1) {
      anyDup = true;
      console.log(`${name}: ${cats.length} copies`);
      cats.forEach((c) =>
        console.log(`  - ${c.id} (system: ${c.isSystem}, userId: ${c.userId})`),
      );
    }
  }
  if (!anyDup) console.log('(none)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
