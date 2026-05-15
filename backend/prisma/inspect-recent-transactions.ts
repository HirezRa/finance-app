/**
 * N עסקאות אחרונות ב־DB (ברירת מחדל 30) — תאריכים, עוגן תזרים, האם היו נכללות בדשבורד
 * למחזור תקציב נתון (ברירת מחדל מאי 2026), וסיבות אפשריות להסתרה.
 *
 * הרצה מתוך **`backend/`** או Docker **`cd /app`**:
 *   npx ts-node prisma/inspect-recent-transactions.ts
 *   INSPECT_LIMIT=50 TARGET_YEAR=2026 TARGET_MONTH=5 USER_ID=<uuid> npx ts-node prisma/inspect-recent-transactions.ts
 *
 * npm:
 *   npm run inspect:recent-txns
 *   npm run inspect:recent-txns -- --limit=30
 */
import './prisma-env-bootstrap';
import { PrismaClient, TransactionStatus } from '@prisma/client';

import { getIsraelYmd, getUtcWideRangeForIsraelMonth } from '../src/common/utils/israel-calendar';
import { getUtcWideRangeForBudgetCycle, isInBudgetCycle } from '../src/common/utils/budget-cycle';
import { cashFlowAnchorDateForTxn } from '../src/common/utils/salary-effective-date';

if (!process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL חסר. בקונטיינר: ודא שהשירות מקבל את המשתנה כמו ב־compose.');
  process.exit(1);
}

const prisma = new PrismaClient();

const argLimit = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
const limit = Math.min(
  500,
  Math.max(1, Number(argLimit || process.env.INSPECT_LIMIT || 30)),
);
const targetYear = Number(process.env.TARGET_YEAR || 2026);
const targetMonth = Number(process.env.TARGET_MONTH || 5);
const userIdFilter = process.env.USER_ID?.trim() || null;

function pad(s: string, n: number): string {
  const t = s.length > n ? s.slice(0, n - 1) + '…' : s;
  return t.padEnd(n);
}

function fmtIl(d: Date): string {
  const { year, month, day } = getIsraelYmd(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function main() {
  if (!Number.isInteger(targetYear) || !Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    throw new Error('TARGET_YEAR / TARGET_MONTH לא תקינים');
  }

  const { start: rangeStart, end: rangeEnd } = getUtcWideRangeForBudgetCycle(
    targetYear,
    targetMonth,
    1,
  );

  const rows = await prisma.transaction.findMany({
    where: userIdFilter ? { account: { userId: userIdFilter } } : {},
    orderBy: { date: 'desc' },
    take: limit,
    include: {
      category: { select: { name: true, nameHe: true, isIncome: true } },
      account: {
        select: {
          institutionName: true,
          nickname: true,
          accountNumber: true,
          userId: true,
        },
      },
    },
  });

  const userIds = [...new Set(rows.map((r) => r.account.userId))];
  const settingsRows = await prisma.userSettings.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      budgetCycleStartDay: true,
      includePendingInDashboard: true,
    },
  });
  const settingsByUser = new Map(settingsRows.map((s) => [s.userId, s]));

  console.log(
    `\n=== inspect-recent-transactions ===\n` +
      `LIMIT=${limit} | דשבורד simulation: year=${targetYear} month=${targetMonth} (מחזור יום 1)\n` +
      `חלון Prisma רחב: ${rangeStart.toISOString()} … ${rangeEnd.toISOString()}\n` +
      `משתמש: ${userIdFilter ?? '(כולם — לפי העסקאות שנמשכו)'}\n`,
  );

  const header =
    `${pad('#', 3)} ${pad('date_IL', 12)} ${pad('anchor_IL', 12)} ${pad('eff_IL', 12)} ` +
    `${pad('ΣNIS', 12)} ${pad('inc', 4)} ${pad('stat', 9)} ${pad('excl', 5)} ` +
    `${pad('wide', 4)} ${pad('cycl', 4)} ${pad('dash', 4)} ${pad('הערות', 40)} ${pad('תיאור', 28)}`;
  console.log(header);
  console.log('-'.repeat(Math.min(header.length, 160)));

  let i = 0;
  for (const t of rows) {
    i++;
    const uid = t.account.userId;
    const st = settingsByUser.get(uid);
    const cycleDay = st?.budgetCycleStartDay ?? 1;
    const includePending = st?.includePendingInDashboard ?? true;

    const anchor = cashFlowAnchorDateForTxn({
      date: t.date,
      effectiveDate: t.effectiveDate,
      category: t.category ?? undefined,
    });

    const inWide =
      (t.date >= rangeStart && t.date <= rangeEnd) ||
      (t.effectiveDate !== null && t.effectiveDate >= rangeStart && t.effectiveDate <= rangeEnd);

    const inCycle = isInBudgetCycle(anchor, targetYear, targetMonth, cycleDay);

    const statusOk = includePending || t.status === TransactionStatus.COMPLETED;
    const dash = inWide && inCycle && !t.isExcludedFromCashFlow && statusOk;

    const hints: string[] = [];
    if (t.isExcludedFromCashFlow) hints.push('מוחרג מתזרים');
    if (!statusOk) hints.push('ממתין וללא כלילה בדשבורד');
    if (!inWide) hints.push('מחוץ לטווח רחב של החודש');
    if (inWide && !inCycle) hints.push('עוגן לא במחזור תקציב');
    if (dash && t.category && !t.category.isIncome && Number(t.amount) > 0) {
      hints.push('סכום+ אך לא קטגוריית הכנסה');
    }

    const amountStr = Number(t.amount).toLocaleString('he-IL', { maximumFractionDigits: 0 });
    const line =
      `${pad(String(i), 3)} ${pad(fmtIl(t.date), 12)} ${pad(fmtIl(anchor), 12)} ` +
      `${pad(t.effectiveDate ? fmtIl(t.effectiveDate) : '—', 12)} ` +
      `${pad(amountStr, 12)} ` +
      `${pad(t.category?.isIncome ? 'yes' : 'no', 4)} ${pad(t.status, 9)} ` +
      `${pad(t.isExcludedFromCashFlow ? 'Y' : 'N', 5)} ` +
      `${pad(inWide ? 'Y' : 'N', 4)} ${pad(inCycle ? 'Y' : 'N', 4)} ${pad(dash ? 'Y' : 'N', 4)} ` +
      `${pad(hints.join('; ') || '—', 40)} ${pad(t.description, 28)}`;

    console.log(line);
  }

  const may1Candidates = rows.filter((t) => {
    const ymd = getIsraelYmd(t.date);
    return ymd.year === targetYear && ymd.month === targetMonth && ymd.day === 1;
  });

  console.log('\n--- סיכום: עסקאות שיום הבנק בלוח ישראל הוא 1 בחודש היעד (ברשימת ה-' + limit + ') ---');
  if (may1Candidates.length === 0) {
    console.log('לא נמצאו ברשימה.');
  } else {
    for (const t of may1Candidates) {
      const uid = t.account.userId;
      const st = settingsByUser.get(uid);
      const cycleDay = st?.budgetCycleStartDay ?? 1;
      const includePending = st?.includePendingInDashboard ?? true;
      const anchor = cashFlowAnchorDateForTxn({
        date: t.date,
        effectiveDate: t.effectiveDate,
        category: t.category ?? undefined,
      });
      const inWide =
        (t.date >= rangeStart && t.date <= rangeEnd) ||
        (t.effectiveDate !== null && t.effectiveDate >= rangeStart && t.effectiveDate <= rangeEnd);
      const inCycle = isInBudgetCycle(anchor, targetYear, targetMonth, cycleDay);
      const statusOk = includePending || t.status === TransactionStatus.COMPLETED;
      const dash = inWide && inCycle && !t.isExcludedFromCashFlow && statusOk;

      console.log(
        `  id=${t.id} amount=${t.amount} inc=${t.category?.isIncome ?? false} ` +
          `dash=${dash} desc=${t.description.slice(0, 80)} | acct=${t.account.institutionName}`,
      );
    }
  }

  const mayWide = getUtcWideRangeForIsraelMonth(targetYear, targetMonth);
  const mayCandidatesDb = await prisma.transaction.findMany({
    where: {
      ...(userIdFilter ? { account: { userId: userIdFilter } } : {}),
      date: { gte: mayWide.start, lte: mayWide.end },
    },
    include: {
      category: { select: { isIncome: true, nameHe: true } },
      account: { select: { institutionName: true, userId: true } },
    },
    take: 500,
  });
  const may1BankDayAll = mayCandidatesDb.filter((t) => {
    const ymd = getIsraelYmd(t.date);
    return ymd.year === targetYear && ymd.month === targetMonth && ymd.day === 1;
  });

  const extraUids = [...new Set(may1BankDayAll.map((t) => t.account.userId))].filter(
    (uid) => !settingsByUser.has(uid),
  );
  if (extraUids.length > 0) {
    const more = await prisma.userSettings.findMany({
      where: { userId: { in: extraUids } },
      select: {
        userId: true,
        budgetCycleStartDay: true,
        includePendingInDashboard: true,
      },
    });
    for (const s of more) settingsByUser.set(s.userId, s);
  }

  console.log(
    `\n--- כל העסקאות ב־DB עם יום בנק ישראלי = 1 ב־${targetYear}-${String(targetMonth).padStart(2, '0')} (עד 500 בחלון חודש) ---`,
  );
  console.log(`נמצאו: ${may1BankDayAll.length}`);
  for (const t of may1BankDayAll) {
    const uid = t.account.userId;
    const st = settingsByUser.get(uid);
    const cycleDay = st?.budgetCycleStartDay ?? 1;
    const includePending = st?.includePendingInDashboard ?? true;
    const anchor = cashFlowAnchorDateForTxn({
      date: t.date,
      effectiveDate: t.effectiveDate,
      category: t.category ?? undefined,
    });
    const inWide =
      (t.date >= rangeStart && t.date <= rangeEnd) ||
      (t.effectiveDate !== null && t.effectiveDate >= rangeStart && t.effectiveDate <= rangeEnd);
    const inCycle = isInBudgetCycle(anchor, targetYear, targetMonth, cycleDay);
    const statusOk = includePending || t.status === TransactionStatus.COMPLETED;
    const dash = inWide && inCycle && !t.isExcludedFromCashFlow && statusOk;
    console.log(
      `  id=${t.id} amt=${t.amount} inc=${t.category?.isIncome ?? false} cat=${t.category?.nameHe ?? '—'} ` +
        `excl=${t.isExcludedFromCashFlow} st=${t.status} dash=${dash} | ${t.description.slice(0, 70)} | ${t.account.institutionName}`,
    );
  }

  console.log(
    '\nעמודות: wide=בטווח רחב לשאילתת דשבורד | cycl=עוגן בתוך מחזור תקציב | dash=היתה נספרת בסיכום תזרים להכנסות/הוצאות\n',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
