/**
 * One-off: set sortOrder 0..n-1 per budget by createdAt (then id).
 * Run: npx ts-node prisma/fix-budget-sort-order.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Setting Initial Budget Category Sort Order ===\n');

  const budgets = await prisma.budget.findMany({
    include: {
      categories: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  let updated = 0;
  for (const budget of budgets) {
    for (let i = 0; i < budget.categories.length; i++) {
      await prisma.budgetCategory.update({
        where: { id: budget.categories[i].id },
        data: { sortOrder: i },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} budget category rows across ${budgets.length} budgets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
