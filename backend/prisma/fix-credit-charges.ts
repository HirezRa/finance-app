/**
 * One-off: mark bank transactions that look like aggregate credit-card charges
 * as excluded from cash flow / budget.
 *
 * Run: npx ts-node prisma/fix-credit-charges.ts
 * (Docker: docker compose exec -T backend npx ts-node prisma/fix-credit-charges.ts)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CREDIT_CARD_KEYWORDS = [
  'ישראכרט',
  'isracard',
  'כרטיסי אשראי',
  'מקס איט',
  'max it',
  'ויזה כאל',
  'visa cal',
  'לאומי קארד',
  'leumi card',
  'אמריקן אקספרס',
  'american express',
  'פרימיום אקספרס',
  'דיינרס',
  'diners',
];

function isCreditChargeDescription(description: string): boolean {
  const lowerDesc = description.toLowerCase();
  return CREDIT_CARD_KEYWORDS.some((kw) => lowerDesc.includes(kw.toLowerCase()));
}

async function userAllowsAutoExclude(userId: string): Promise<boolean> {
  const s = await prisma.userSettings.findUnique({
    where: { userId },
    select: { excludeCreditCardChargesFromBudget: true },
  });
  if (!s) return true;
  return s.excludeCreditCardChargesFromBudget !== false;
}

async function main() {
  console.log('=== Fixing Credit Card Charges (bank aggregate lines) ===\n');

  const bankAccounts = await prisma.account.findMany({
    where: { accountType: 'BANK' },
    select: { id: true, userId: true, institutionName: true },
  });

  console.log(`Found ${bankAccounts.length} bank accounts`);

  const allowedAccountIds: string[] = [];
  for (const a of bankAccounts) {
    if (await userAllowsAutoExclude(a.userId)) {
      allowedAccountIds.push(a.id);
    }
  }

  if (allowedAccountIds.length === 0) {
    console.log('No bank accounts under users with auto-exclude enabled.');
    return;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      accountId: { in: allowedAccountIds },
      amount: { lt: 0 },
      isExcludedFromCashFlow: false,
    },
    select: { id: true, description: true, amount: true },
  });

  console.log(`Checking ${transactions.length} debit transactions...`);

  let updated = 0;
  for (const txn of transactions) {
    if (!isCreditChargeDescription(txn.description || '')) continue;

    await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        isExcludedFromCashFlow: true,
        note: 'חיוב אשראי - לא נספר בתקציב (נספר דרך חברת האשראי)',
      },
    });
    console.log(`Excluded: ${txn.description} (${txn.amount})`);
    updated++;
  }

  console.log(`\nUpdated ${updated} transactions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
