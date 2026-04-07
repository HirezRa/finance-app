/**
 * One-off: derive TransactionType from description / installments.
 * Run: npx ts-node prisma/fix-transaction-types.ts
 */
import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

function classify(
  description: string,
  installmentTotal: number | null,
): TransactionType {
  const totalInst =
    installmentTotal !== undefined && installmentTotal !== null
      ? Number(installmentTotal)
      : NaN;
  if (Number.isFinite(totalInst) && totalInst > 1) {
    return TransactionType.INSTALLMENTS;
  }

  const desc = (description || '').toLowerCase();
  if (desc.includes('זיכוי') || desc.includes('החזר') || desc.includes('refund')) {
    return TransactionType.REFUND;
  }
  if (
    desc.includes('משיכה') ||
    desc.includes('מזומן') ||
    desc.includes('כספומט') ||
    desc.includes('atm')
  ) {
    return TransactionType.CASH;
  }
  if (
    desc.includes('העברה') ||
    desc.includes('transfer') ||
    desc.includes('bit') ||
    desc.includes('paybox')
  ) {
    return TransactionType.TRANSFER;
  }
  if (desc.includes('עמלה') || desc.includes('דמי ניהול') || desc.includes('fee')) {
    return TransactionType.FEE;
  }
  if (desc.includes('ריבית') || desc.includes('interest')) {
    return TransactionType.INTEREST;
  }
  return TransactionType.NORMAL;
}

async function main() {
  console.log('=== Updating Transaction Types ===\n');

  const transactions = await prisma.transaction.findMany({
    select: {
      id: true,
      description: true,
      installmentTotal: true,
      type: true,
    },
  });

  let updated = 0;
  for (const txn of transactions) {
    const next = classify(
      txn.description,
      txn.installmentTotal !== null ? Number(txn.installmentTotal) : null,
    );
    if (next !== txn.type) {
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { type: next },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} transactions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
