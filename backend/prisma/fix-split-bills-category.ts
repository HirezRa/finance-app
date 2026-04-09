/**
 * One-off: split legacy "bills" / "חשבונות" into electricity, water, vaad_bayit, arnona, gas.
 * Run: npx ts-node prisma/fix-split-bills-category.ts
 * Docker: docker compose exec -T backend npx ts-node prisma/fix-split-bills-category.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const NEW_CATS: {
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  keywords: string[];
}[] = [
  {
    name: 'electricity',
    nameHe: 'חשבון חשמל',
    icon: '⚡',
    color: '#f97316',
    keywords: ['חשמל', 'חברת חשמל', 'IEC', 'electricity'],
  },
  {
    name: 'water',
    nameHe: 'חשבון מים',
    icon: '💧',
    color: '#0ea5e9',
    keywords: ['מים', 'מי ', 'תאגיד מים', 'water'],
  },
  {
    name: 'vaad_bayit',
    nameHe: 'ועד בית',
    icon: '🏢',
    color: '#8b5cf6',
    keywords: ['ועד בית', 'ועד הבית', 'דמי ועד'],
  },
  {
    name: 'arnona',
    nameHe: 'ארנונה',
    icon: '🏛️',
    color: '#ec4899',
    keywords: ['ארנונה', 'עירייה', 'מועצה', 'arnona'],
  },
  {
    name: 'gas',
    nameHe: 'חשבון גז',
    icon: '🔥',
    color: '#f59e0b',
    keywords: ['גז', 'פזגז', 'סופרגז', 'אמישראגז', 'gas'],
  },
];

function pickSplitCategory(descLower: string): string | null {
  if (
    descLower.includes('חשמל') ||
    descLower.includes('iec') ||
    descLower.includes('electricity')
  ) {
    return 'electricity';
  }
  if (
    descLower.includes('מים') ||
    descLower.includes('תאגיד מים') ||
    descLower.includes('water')
  ) {
    return 'water';
  }
  if (
    descLower.includes('ועד') ||
    descLower.includes('בית משותף') ||
    descLower.includes('דמי ועד')
  ) {
    return 'vaad_bayit';
  }
  if (
    descLower.includes('ארנונה') ||
    descLower.includes('עירייה') ||
    descLower.includes('מועצה') ||
    descLower.includes('arnona')
  ) {
    return 'arnona';
  }
  if (
    descLower.includes('גז') ||
    descLower.includes('פזגז') ||
    descLower.includes('סופרגז') ||
    descLower.includes('אמישראגז')
  ) {
    return 'gas';
  }
  return null;
}

async function main() {
  console.log('=== Splitting bills category ===\n');

  const billsCategories = await prisma.category.findMany({
    where: {
      OR: [{ name: 'bills' }, { nameHe: 'חשבונות' }],
    },
  });

  console.log(`Found ${billsCategories.length} legacy bills categories\n`);

  for (const oldCat of billsCategories) {
    const userId = oldCat.userId;
    if (!userId) {
      console.log(
        `Skip category id=${oldCat.id} nameHe=${oldCat.nameHe} (no userId — system row)`,
      );
      continue;
    }

    const existingNew = await prisma.category.findFirst({
      where: { userId, name: 'electricity' },
    });

    if (existingNew) {
      console.log(`User ${userId}: split categories already exist, skipping`);
      continue;
    }

    for (const cat of NEW_CATS) {
      const kw = cat.keywords as unknown as Prisma.InputJsonValue;
      await prisma.category.create({
        data: {
          userId,
          name: cat.name,
          nameHe: cat.nameHe,
          icon: cat.icon,
          color: cat.color,
          isFixed: true,
          isTracked: true,
          isIncome: false,
          keywords: kw,
        },
      });
      console.log(`Created ${cat.nameHe} for user ${userId}`);
    }

    const transactions = await prisma.transaction.findMany({
      where: { categoryId: oldCat.id },
    });

    console.log(`Processing ${transactions.length} transactions from "${oldCat.nameHe}"`);

    for (const tx of transactions) {
      const desc = (tx.description ?? '').toLowerCase();
      const newCategoryName = pickSplitCategory(desc);
      if (!newCategoryName) continue;

      const newCat = await prisma.category.findFirst({
        where: { userId, name: newCategoryName },
      });

      if (newCat) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: newCat.id },
        });
        console.log(`Moved "${tx.description}" -> ${newCategoryName}`);
      }
    }

    const remainingTx = await prisma.transaction.count({
      where: { categoryId: oldCat.id },
    });

    if (remainingTx === 0) {
      await prisma.budgetCategory.deleteMany({
        where: { categoryId: oldCat.id },
      });

      await prisma.category.delete({
        where: { id: oldCat.id },
      });
      console.log(`Deleted old category "${oldCat.nameHe}" (${oldCat.id})\n`);
    } else {
      console.log(
        `Kept "${oldCat.nameHe}" with ${remainingTx} uncategorized-by-keyword transactions\n`,
      );
    }
  }

  console.log('=== Done ===');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
