import {
  getIsraelYearMonth,
  getUtcWideRangeForIsraelMonth,
  daysInMonth,
} from './israel-calendar';

/** Israel civil Y-M-D for a stored UTC instant (Asia/Jerusalem). */
export function getIsraelYmd(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

export type BudgetCycleDay = { y: number; m: number; d: number };

/**
 * Wide UTC window for Prisma queries; filter rows with {@link isInBudgetCycle}.
 */
export function getUtcWideRangeForBudgetCycle(
  year: number,
  month: number,
  cycleStartDay: number,
): { start: Date; end: Date } {
  if (cycleStartDay === 1) {
    return getUtcWideRangeForIsraelMonth(year, month);
  }
  const start = new Date(Date.UTC(year, month - 3, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 2, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Budget cycle labeled (budgetYear, budgetMonth):
 * - startDay 1: Israel calendar month
 * - startDay 10: from budgetMonth/startDay through day 9 of the following month
 */
export function isInBudgetCycle(
  anchor: Date,
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): boolean {
  const { year: y, month: m, day: d } = getIsraelYmd(anchor);
  if (cycleStartDay === 1) {
    return y === budgetYear && m === budgetMonth;
  }
  if (y === budgetYear && m === budgetMonth && d >= cycleStartDay) {
    return true;
  }
  const ny = budgetMonth === 12 ? budgetYear + 1 : budgetYear;
  const nm = budgetMonth === 12 ? 1 : budgetMonth + 1;
  return y === ny && m === nm && d <= 9;
}

/** Which budget-cycle label (month/year) an Israel date belongs to. */
export function getBudgetCycleLabelForIsraelDate(
  date: Date,
  cycleStartDay: number,
): { year: number; month: number } {
  if (cycleStartDay === 1) {
    return getIsraelYearMonth(date);
  }
  const { year: y, month: m, day: d } = getIsraelYmd(date);
  if (d >= cycleStartDay) {
    return { year: y, month: m };
  }
  if (m === 1) {
    return { year: y - 1, month: 12 };
  }
  return { year: y, month: m - 1 };
}

function atUtcNoon(y: number, mo: number, day: number): Date {
  return new Date(Date.UTC(y, mo - 1, day, 12, 0, 0, 0));
}

export function getBudgetCycleStartCivil(
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): BudgetCycleDay {
  if (cycleStartDay === 1) {
    return { y: budgetYear, m: budgetMonth, d: 1 };
  }
  return { y: budgetYear, m: budgetMonth, d: cycleStartDay };
}

export function getBudgetCycleEndCivil(
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): BudgetCycleDay {
  if (cycleStartDay === 1) {
    return {
      y: budgetYear,
      m: budgetMonth,
      d: daysInMonth(budgetYear, budgetMonth),
    };
  }
  const ny = budgetMonth === 12 ? budgetYear + 1 : budgetYear;
  const nm = budgetMonth === 12 ? 1 : budgetMonth + 1;
  return { y: ny, m: nm, d: 9 };
}

/**
 * Days left in the budget cycle (inclusive of today), or full cycle length if the cycle has not started yet.
 * `null` if the cycle has already ended.
 */
export function daysRemainingInBudgetCycle(
  now: Date,
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): number | null {
  const today = getIsraelYmd(now);
  const start = getBudgetCycleStartCivil(budgetYear, budgetMonth, cycleStartDay);
  const end = getBudgetCycleEndCivil(budgetYear, budgetMonth, cycleStartDay);

  const todayT = atUtcNoon(today.year, today.month, today.day).getTime();
  const startT = atUtcNoon(start.y, start.m, start.d).getTime();
  const endT = atUtcNoon(end.y, end.m, end.d).getTime();

  if (todayT > endT) {
    return null;
  }
  if (todayT < startT) {
    return Math.max(1, Math.round((endT - startT) / 86400000) + 1);
  }
  return Math.max(1, Math.round((endT - todayT) / 86400000) + 1);
}

export function listBudgetCycleDays(
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): BudgetCycleDay[] {
  const out: BudgetCycleDay[] = [];
  if (cycleStartDay === 1) {
    const dim = daysInMonth(budgetYear, budgetMonth);
    for (let d = 1; d <= dim; d++) {
      out.push({ y: budgetYear, m: budgetMonth, d });
    }
    return out;
  }
  const dim = daysInMonth(budgetYear, budgetMonth);
  for (let d = cycleStartDay; d <= dim; d++) {
    out.push({ y: budgetYear, m: budgetMonth, d });
  }
  const ny = budgetMonth === 12 ? budgetYear + 1 : budgetYear;
  const nm = budgetMonth === 12 ? 1 : budgetMonth + 1;
  for (let d = 1; d <= 9; d++) {
    out.push({ y: ny, m: nm, d });
  }
  return out;
}

export function buildBudgetCycleWeekBuckets(
  budgetYear: number,
  budgetMonth: number,
  cycleStartDay: number,
): { week: number; startDate: string; endDate: string; days: BudgetCycleDay[] }[] {
  const cycleDays = listBudgetCycleDays(budgetYear, budgetMonth, cycleStartDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  const buckets: { week: number; startDate: string; endDate: string; days: BudgetCycleDay[] }[] =
    [];
  for (let i = 0; i < cycleDays.length; i += 7) {
    const chunk = cycleDays.slice(i, i + 7);
    const f = chunk[0];
    const l = chunk[chunk.length - 1];
    buckets.push({
      week: buckets.length + 1,
      startDate: `${f.y}-${pad(f.m)}-${pad(f.d)}`,
      endDate: `${l.y}-${pad(l.m)}-${pad(l.d)}`,
      days: chunk,
    });
  }
  return buckets;
}

export function israelYmdInDayList(anchor: Date, days: BudgetCycleDay[]): boolean {
  const { year: y, month: m, day: d } = getIsraelYmd(anchor);
  return days.some((c) => c.y === y && c.m === m && c.d === d);
}
