/**
 * מתקן רשומות שמקורן בסנכרון לפני נרמול תאריך 2.0.58: מעדכן `date` (ותלות) לפי
 * `rawData.date` + {@link normalizeScraperDateFromRaw}, מחשב מחדש `scraperHash`,
 * `pendingMatchHash`, ו־`effectiveDate` להכנסות לפי UserSettings (טווח משכורת).
 *
 * מומלץ להריץ **אחרי** clear-early-month-income-effective-date (או לכלול לוגיקה דומה).
 *
 * Usage (מ־backend/, ברירת מחדל dry-run):
 *   npx ts-node prisma/heal-transaction-date-from-scraper-raw.ts
 *
 * Docker: `cd /app` לפני ההרצה (אותו WORKDIR כמו השרת).
 *
 * ביצוע:
 *   npx ts-node prisma/heal-transaction-date-from-scraper-raw.ts --execute
 *
 * ENV:
 *   BANK_YEAR=2026 BANK_MONTH=5  — מסנן רק עסקאות שב־DB date בחלון רחב סביב חודש ישראלי זה (ברירת 2026-05)
 *   USER_ID=<uuid>               — מגביל למשתמש (אופציונלי)
 *   INCOME_ONLY=0                — כל העסקאות עם rawData.date (ברירת מחדל: רק הכנסה)
 */
import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';

import { getIsraelDayOfMonth, getIsraelYearMonth } from '../src/common/utils/israel-calendar';
import { normalizeScraperDateFromRaw } from '../src/common/utils/scraper-date-normalize';
import { computeSalaryEffectiveDateForBankDate } from '../src/common/utils/salary-effective-date';

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes('--execute');
const bankYear = Number(process.env.BANK_YEAR || 2026);
const bankMonth = Number(process.env.BANK_MONTH || 5);
const userIdFilter = process.env.USER_ID?.trim() || null;
/** ברירת מחדל: רק הכנסות (משכורות והכנסות אחרות). כבה עם INCOME_ONLY=0 */
const incomeOnly =
  process.env.INCOME_ONLY === undefined ||
  process.env.INCOME_ONLY === '' ||
  (process.env.INCOME_ONLY !== '0' && process.env.INCOME_ONLY?.toLowerCase() !== 'false');

function wideUtcRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

function normalizeTxnText(s: string | undefined | null): string {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200f\u200e]/g, '');
}

function normalizeDescPending(desc: string): string {
  return (desc || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200f\u200e]/g, '')
    .toLowerCase()
    .substring(0, 50);
}

function buildScraperHash(
  accountId: string,
  ymdIso: string,
  txn: {
    chargedAmount?: unknown;
    amount?: unknown;
    description?: unknown;
    memo?: unknown;
    referenceNumber?: unknown;
    identifier?: unknown;
  },
  amountFromDb: Prisma.Decimal,
): string {
  const normalizedDesc = normalizeTxnText(String(txn.description ?? txn.memo ?? ''));
  let raw =
    txn.chargedAmount !== undefined && txn.chargedAmount !== null
      ? Number(txn.chargedAmount)
      : txn.amount !== undefined && txn.amount !== null
        ? Number(txn.amount)
        : NaN;
  if (!Number.isFinite(raw)) {
    raw = Number(amountFromDb);
  }
  const amountStr = Number.isFinite(raw) ? raw.toFixed(2) : '0.00';
  const idRaw = txn.referenceNumber ?? txn.identifier;
  const bankId =
    idRaw === null || idRaw === undefined || idRaw === '' ? '' : String(idRaw);
  const hashInput = `${accountId}|${ymdIso}|${amountStr}|${normalizedDesc}|${bankId}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

function buildPendingMatchHash(
  accountId: string,
  date: Date,
  amount: number,
  description: string,
): string {
  const normalizedDesc = normalizeDescPending(description);
  const { month } = getIsraelYearMonth(date);
  const day = getIsraelDayOfMonth(date);
  const monthDay = `${month}-${day}`;
  const roundedAmount = Math.round(Number.isFinite(amount) ? amount : 0);
  const input = `${accountId}|${monthDay}|${roundedAmount}|${normalizedDesc}`;
  return createHash('md5').update(input).digest('hex').substring(0, 16);
}

function rawDateFromJson(raw: Prisma.JsonValue | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const d = o.date;
  if (d === null || d === undefined) return null;
  return String(d);
}

async function main() {
  if (!Number.isInteger(bankYear) || !Number.isInteger(bankMonth) || bankMonth < 1 || bankMonth > 12) {
    throw new Error('Invalid BANK_YEAR / BANK_MONTH');
  }

  const { start, end } = wideUtcRange(bankYear, bankMonth);

  const rows = await prisma.transaction.findMany({
    where: {
      rawData: { not: Prisma.DbNull },
      date: { gte: start, lte: end },
      ...(userIdFilter ? { account: { userId: userIdFilter } } : {}),
      ...(incomeOnly ? { category: { isIncome: true } } : {}),
    },
    select: {
      id: true,
      accountId: true,
      date: true,
      effectiveDate: true,
      amount: true,
      description: true,
      scraperHash: true,
      rawData: true,
      category: { select: { isIncome: true } },
      account: { select: { userId: true } },
    },
  });

  const userIds = [...new Set(rows.map((r) => r.account.userId))];
  const settingsRows = await prisma.userSettings.findMany({
    where: { userId: { in: userIds } },
  });
  const settingsByUser = new Map(settingsRows.map((s) => [s.userId, s]));

  type Plan = {
    id: string;
    oldDate: string;
    newDate: string;
    ymdIso: string;
    userId: string;
    newHash: string;
    newPendingHash: string;
    newEffective: Date | null;
    descPreview: string;
  };

  const plans: Plan[] = [];

  for (const t of rows) {
    const rawStr = rawDateFromJson(t.rawData);
    if (!rawStr) continue;

    const norm = normalizeScraperDateFromRaw(rawStr, (m) => {
      if (plans.length < 5) console.warn(`[warn row ${t.id}] ${m}`);
    });

    if (norm.dateForRow.getTime() === t.date.getTime()) {
      continue;
    }

    const rawObj =
      t.rawData && typeof t.rawData === 'object' && !Array.isArray(t.rawData)
        ? (t.rawData as Record<string, unknown>)
        : {};

    const newHash = buildScraperHash(t.accountId, norm.ymdIso, rawObj, t.amount);
    const amtNum = Number(t.amount);
    const newPendingHash = buildPendingMatchHash(
      t.accountId,
      norm.dateForRow,
      amtNum,
      t.description,
    );

    const set = settingsByUser.get(t.account.userId);
    const salaryStart = set?.salaryStartDay ?? 25;
    const salaryEnd = set?.salaryEndDay ?? 31;

    let newEffective: Date | null = t.effectiveDate;
    if (t.category?.isIncome) {
      newEffective = computeSalaryEffectiveDateForBankDate(
        norm.dateForRow,
        true,
        salaryStart,
        salaryEnd,
      );
    }

    plans.push({
      id: t.id,
      oldDate: t.date.toISOString(),
      newDate: norm.dateForRow.toISOString(),
      ymdIso: norm.ymdIso,
      userId: t.account.userId,
      newHash,
      newPendingHash,
      newEffective,
      descPreview: t.description.slice(0, 60),
    });
  }

  console.log(
    `Mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}\n` +
      `Window: Israel ~${bankYear}-${String(bankMonth).padStart(2, '0')} (DB date in ${start.toISOString()} … ${end.toISOString()})\n` +
      `User filter: ${userIdFilter ?? '(all)'}\n` +
      `Income only: ${incomeOnly}\n` +
      `Rows scanned: ${rows.length}, to fix (date differs from rawData): ${plans.length}\n`,
  );

  if (!EXECUTE && plans.length) {
    console.log('Sample (up to 25):');
    for (const p of plans.slice(0, 25)) {
      console.log(
        `  id=${p.id} user=${p.userId} ${p.oldDate} -> ${p.newDate} (IL ${p.ymdIso}) ${p.descPreview}`,
      );
    }
    console.log('\nRe-run with --execute to apply.');
  }

  if (!EXECUTE) {
    return;
  }

  let ok = 0;
  let err = 0;

  for (const p of plans) {
    const other = await prisma.transaction.findFirst({
      where: {
        scraperHash: p.newHash,
        NOT: { id: p.id },
      },
      select: { id: true },
    });
    if (other) {
      console.error(
        `SKIP id=${p.id}: scraperHash collision with ${other.id} — resolve duplicates manually`,
      );
      err++;
      continue;
    }

    try {
      await prisma.transaction.update({
        where: { id: p.id },
        data: {
          date: new Date(p.newDate),
          scraperHash: p.newHash,
          pendingMatchHash: p.newPendingHash,
          effectiveDate: p.newEffective,
        },
      });
      ok++;
    } catch (e) {
      console.error(`FAIL id=${p.id}:`, e instanceof Error ? e.message : e);
      err++;
    }
  }

  console.log(`Updated ${ok} row(s). Skipped/failed ${err}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
