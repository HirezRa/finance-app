/**
 * מדפיס לקונסולה את כל עסקאות המשכורת (או כל ההכנסות) מבסיס הנתונים:
 * תאריך בנק (לוח ישראלי), תאריך אפקטיבי (אם יש), סכום, קטגוריה, חשבון, תיאור.
 *
 * חובה להריץ מתוך תיקיית **`backend/`** (לא מתוך `prisma/`) — אחרת ts-node יחפש קובץ בשם שגוי.
 *
 * מהשורש של הריפו (מומלץ):
 *   ./scripts/list-salary-txns.sh
 *   ./scripts/list-salary-txns.sh --all-income
 *
 * ידנית מתוך `backend/` (אחרי `DATABASE_URL` ב־`.env`):
 *   npm run list:salary-txns
 *   npm run list:salary-txns -- --all-income
 *
 * בתוך קונטיינר backend (אחרי build שמעדכן את `prisma/` בתוך האימג׳; WORKDIR=/app):
 *   docker compose exec backend sh -lc 'cd /app && npx ts-node prisma/list-salary-transactions.ts --all-income'
 *
 * אם `npm run list:salary-txns` לא קיים — עדכן קוד: `git pull origin main` (והרץ `npm install` ב־backend אם אין node_modules).
 *
 * משתמש בודד (לפי `Account.userId`):
 *   USER_ID=<uuid> npm run list:salary-txns
 */
import { Prisma, PrismaClient } from '@prisma/client';

import { getIsraelYmd } from '../src/common/utils/israel-calendar';

const prisma = new PrismaClient();

const allIncome = process.argv.includes('--all-income');
const userIdFilter = process.env.USER_ID?.trim() || null;

function categoryWhere(): Prisma.CategoryWhereInput {
  if (allIncome) {
    return { isIncome: true };
  }
  return {
    isIncome: true,
    OR: [
      { name: { equals: 'salary', mode: 'insensitive' } },
      { nameHe: { contains: 'משכורת', mode: 'insensitive' } },
    ],
  };
}

function fmtIsrael(d: Date): string {
  const { year, month, day } = getIsraelYmd(d);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fmtMoney(v: Prisma.Decimal): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
}

async function main() {
  const catWhere: Prisma.CategoryWhereInput = {
    AND: [
      categoryWhere(),
      ...(userIdFilter ? [{ OR: [{ userId: null }, { userId: userIdFilter }] }] : []),
    ],
  };

  const categories = await prisma.category.findMany({
    where: catWhere,
    select: { id: true, name: true, nameHe: true },
  });
  const catIds = categories.map((c) => c.id);

  if (catIds.length === 0) {
    console.log('לא נמצאו קטגוריות תואמות (נסה --all-income או בדוק USER_ID).');
    return;
  }

  const rows = await prisma.transaction.findMany({
    where: {
      categoryId: { in: catIds },
      ...(userIdFilter ? { account: { userId: userIdFilter } } : {}),
    },
    orderBy: { date: 'desc' },
    include: {
      category: { select: { name: true, nameHe: true } },
      account: {
        select: {
          nickname: true,
          institutionName: true,
          accountNumber: true,
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  const modeLabel = allIncome ? 'כל עסקאות ההכנסה (isIncome)' : 'משכורת (קטגוריית salary / שם בעברית עם ״משכורת״)';
  console.log(`\n=== ${modeLabel} ===`);
  console.log(`רשומות: ${rows.length} | קטגוריות תואמות: ${categories.length}${userIdFilter ? ` | משתמש: ${userIdFilter}` : ''}\n`);

  const col = {
    dateIl: 12,
    effIl: 12,
    amount: 14,
    cur: 5,
    cat: 22,
    acct: 28,
    user: 26,
    desc: 36,
  };

  const head =
    `${'תאריך בנק'.padEnd(col.dateIl)} ${'תאריך אפקטיבי'.padEnd(col.effIl)} ${'סכום ILS'.padStart(col.amount)} ${'מט'.padEnd(col.cur)} ${'קטגוריה'.padEnd(col.cat)} ${'חשבון'.padEnd(col.acct)} ${'משתמש'.padEnd(col.user)} ${'תיאור'.padEnd(col.desc)}`;
  console.log(head);
  console.log('-'.repeat(head.length + 4));

  let sumIls = 0;
  for (const t of rows) {
    const dateIl = fmtIsrael(t.date);
    const effIl = t.effectiveDate ? fmtIsrael(t.effectiveDate) : '—';
    const amt = Number(t.amount);
    if (Number.isFinite(amt)) sumIls += amt;
    const cur = t.originalCurrency || 'ILS';
    const catLabel = (t.category?.nameHe || t.category?.name || '—').slice(0, col.cat);
    const acctLabel = (
      t.account.nickname ||
      `${t.account.institutionName} ${String(t.account.accountNumber).slice(-4)}`
    ).slice(0, col.acct);
    const userLabel = (t.account.user?.email || t.account.userId.slice(0, 8)).slice(0, col.user);
    const desc = (t.description || '').replace(/\s+/g, ' ').slice(0, col.desc);

    console.log(
      `${dateIl.padEnd(col.dateIl)} ${effIl.padEnd(col.effIl)} ${fmtMoney(t.amount).padStart(col.amount)} ${cur.padEnd(col.cur)} ${catLabel.padEnd(col.cat)} ${acctLabel.padEnd(col.acct)} ${userLabel.padEnd(col.user)} ${desc.padEnd(col.desc)}`,
    );
  }

  console.log('-'.repeat(head.length + 4));
  console.log(`סה״כ סכומי שדה amount (ILS): ${sumIls.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
