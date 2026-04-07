/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Cleaning Duplicate Categories (user vs system name collision) ===');

  const systemCats = await prisma.category.findMany({
    where: { isSystem: true },
    select: { id: true, name: true, nameHe: true },
  });

  const systemNames = new Set(systemCats.map((c) => c.name));
  const systemNamesHe = new Set(systemCats.map((c) => c.nameHe));

  const userCats = await prisma.category.findMany({
    where: {
      isSystem: false,
      OR: [{ name: { in: [...systemNames] } }, { nameHe: { in: [...systemNamesHe] } }],
    },
    select: { id: true, name: true, nameHe: true },
  });

  console.log('User categories duplicating system name/nameHe:', userCats.length);

  if (userCats.length === 0) {
    console.log('Total categories:', await prisma.category.count());
    return;
  }

  for (const userCat of userCats) {
    const sysCat = systemCats.find((s) => s.name === userCat.name || s.nameHe === userCat.nameHe);
    if (!sysCat) continue;

    const txnUp = await prisma.transaction.updateMany({
      where: { categoryId: userCat.id },
      data: { categoryId: sysCat.id },
    });
    if (txnUp.count) console.log(`Moved ${txnUp.count} transactions ${userCat.nameHe} -> system`);

    const budUp = await prisma.budgetCategory.updateMany({
      where: { categoryId: userCat.id },
      data: { categoryId: sysCat.id },
    });
    if (budUp.count) console.log(`Updated ${budUp.count} budget lines ${userCat.nameHe} -> system`);
  }

  const deleted = await prisma.category.deleteMany({
    where: { id: { in: userCats.map((c) => c.id) } },
  });
  console.log('Deleted duplicate user categories:', deleted.count);
  console.log('Total categories after:', await prisma.category.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
