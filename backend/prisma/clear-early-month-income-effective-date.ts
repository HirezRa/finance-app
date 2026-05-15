/**
 * One-off: clear mistaken effectiveDate on income rows whose *bank* date falls
 * in an Israel calendar month early segment (day < 15), matching
 * computeSalaryEffectiveDateForBankDate in salary-effective-date.ts.
 *
 * Typical case: May 1 salary with salary window 1–31 got effectiveDate → June;
 * dashboard/transactions filtered by May no longer showed it.
 *
 * Usage (from backend/, default dry-run — prints only):
 *   npx ts-node prisma/clear-early-month-income-effective-date.ts
 *
 * Docker runtime image (`WORKDIR /app`): use `cd /app` first so imports resolve to `src/`.
 *
 * Apply changes:
 *   npx ts-node prisma/clear-early-month-income-effective-date.ts --execute
 *
 * Environment:
 *   BANK_YEAR=2026 BANK_MONTH=5     — Israel civil year/month of bank `date` (default 2026-05)
 *   USER_ID=<uuid>                  — limit to one user (optional)
 *   BANK_DAY_LT=15                  — clear when Israel day-of-month < this (default 15 = days 1–14)
 *
 * Raw SQL (PostgreSQL) equivalent for May 2026, days 1–14 Israel, all users:
 *   See docs/SALARY_EFFECTIVE_DATE.md
 *
 * After upgrading to 2.0.58+, if May income still missing, also run (order matters):
 *   1) This script (clears mistaken effectiveDate)
 *   2) prisma/heal-transaction-date-from-scraper-raw.ts — fixes `date` from rawData when legacy UTC skew hid rows from May
 */
import { PrismaClient } from '@prisma/client';

import { getIsraelYmd } from '../src/common/utils/israel-calendar';

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes('--execute');
const bankYear = Number(process.env.BANK_YEAR || 2026);
const bankMonth = Number(process.env.BANK_MONTH || 5);
const bankDayLt = Number(process.env.BANK_DAY_LT || 15);
const userIdFilter = process.env.USER_ID?.trim() || null;

async function main() {
  if (!Number.isInteger(bankYear) || !Number.isInteger(bankMonth) || bankMonth < 1 || bankMonth > 12) {
    throw new Error('Invalid BANK_YEAR / BANK_MONTH');
  }
  if (!Number.isInteger(bankDayLt) || bankDayLt < 1 || bankDayLt > 31) {
    throw new Error('Invalid BANK_DAY_LT');
  }

  const wideStart = new Date(Date.UTC(bankYear, bankMonth - 2, 1, 0, 0, 0, 0));
  const wideEnd = new Date(Date.UTC(bankYear, bankMonth + 1, 0, 23, 59, 59, 999));

  const where = {
    effectiveDate: { not: null } as const,
    date: { gte: wideStart, lte: wideEnd },
    category: { isIncome: true },
    ...(userIdFilter ? { account: { userId: userIdFilter } } : {}),
  };

  const rows = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      date: true,
      effectiveDate: true,
      account: { select: { userId: true } },
    },
  });

  const targets = rows.filter((t) => {
    const ymd = getIsraelYmd(t.date);
    return (
      ymd.year === bankYear &&
      ymd.month === bankMonth &&
      ymd.day < bankDayLt
    );
  });

  console.log(
    `Mode: ${EXECUTE ? 'EXECUTE (writes)' : 'DRY-RUN (no writes)'}\n` +
      `Israel bank month: ${bankYear}-${String(bankMonth).padStart(2, '0')}, ` +
      `clear when Israel day < ${bankDayLt} and effectiveDate IS NOT NULL\n` +
      `User filter: ${userIdFilter ?? '(all)'}\n` +
      `Candidates in DB window: ${rows.length}, after Israel Y/M/D filter: ${targets.length}\n`,
  );

  if (targets.length && !EXECUTE) {
    console.log('Sample (up to 15):');
    for (const t of targets.slice(0, 15)) {
      const ymd = getIsraelYmd(t.date);
      console.log(
        `  id=${t.id} user=${t.account.userId} bank=${t.date.toISOString()} ` +
          `IsraelYMD=${ymd.year}-${ymd.month}-${ymd.day} effectiveDate=${t.effectiveDate?.toISOString() ?? 'null'}`,
      );
    }
    console.log('\nRe-run with --execute to set effectiveDate = NULL on these rows.');
  }

  if (EXECUTE && targets.length > 0) {
    const res = await prisma.transaction.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { effectiveDate: null },
    });
    console.log(`Updated ${res.count} transaction(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
