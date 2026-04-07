import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UNCATEGORIZED_ID = '00000000-0000-0000-0000-000000000001';

async function main(): Promise<void> {
  await prisma.category.upsert({
    where: { id: UNCATEGORIZED_ID },
    create: {
      id: UNCATEGORIZED_ID,
      name: 'uncategorized',
      nameHe: 'לא מסווג',
      isSystem: true,
      isIncome: false,
      isFixed: false,
      isTracked: false,
      sortOrder: 999,
    },
    update: {},
  });
  console.log('Seed: system category uncategorized OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
