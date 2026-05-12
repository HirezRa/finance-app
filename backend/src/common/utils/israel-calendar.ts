/**
 * Calendar month in Asia/Jerusalem for a stored UTC Date (bank/scraper timestamps).
 */
export function getIsraelYearMonth(d: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(d);

  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  return { year: y, month: m };
}

export function isInIsraelMonth(d: Date, year: number, month: number): boolean {
  const { year: y, month: m } = getIsraelYearMonth(d);
  return y === year && m === month;
}

export function getIsraelDayOfMonth(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      day: 'numeric',
    }).format(d),
  );
}

/** Israel civil Y-M-D for a UTC instant (Asia/Jerusalem). */
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

function israelCivilDateBefore(
  d: Date,
  year: number,
  month: number,
  day: number,
): boolean {
  const { year: y, month: m, day: dom } = getIsraelYmd(d);
  return y < year || (y === year && m < month) || (y === year && m === month && dom < day);
}

/**
 * First UTC instant that falls on Israel civil calendar day (year, month, day).
 */
export function startOfIsraelCivilDayInUtc(year: number, month: number, day: number): Date {
  let lo = Date.UTC(year, month - 1, day - 3, 0, 0, 0, 0);
  let hi = Date.UTC(year, month - 1, day + 3, 0, 0, 0, 0);
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (israelCivilDateBefore(new Date(mid), year, month, day)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}

/**
 * Last UTC instant still on Israel civil day (year, month, day).
 */
export function endOfIsraelCivilDayInUtc(year: number, month: number, day: number): Date {
  let ny = year;
  let nm = month;
  let nd = day + 1;
  const dim = daysInMonth(year, month);
  if (nd > dim) {
    nd = 1;
    nm += 1;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
  }
  const nextStart = startOfIsraelCivilDayInUtc(ny, nm, nd);
  return new Date(nextStart.getTime() - 1);
}

const ISO_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse strict `YYYY-MM-DD` (no time / zone). */
export function parseIsoYmdParts(s: string): { year: number; month: number; day: number } {
  const m = ISO_YMD.exec(s.trim());
  if (!m) {
    throw new Error(`Expected YYYY-MM-DD, got: ${s}`);
  }
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function isStrictIsoDateOnly(s: string): boolean {
  return ISO_YMD.test(s.trim());
}

/** Gregorian month length (Israel uses Gregorian). month 1–12 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Loose UTC window for DB queries; filter rows with {@link isInIsraelMonth}.
 * month is 1–12 (calendar month in Israel).
 */
export function getUtcWideRangeForIsraelMonth(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * Noon UTC on a civil calendar day in (year, month) — stable anchor for Israel-month
 * grouping when paired with {@link getIsraelYearMonth}.
 */
export function startOfIsraelMonthDay(year: number, month: number, day = 1): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/**
 * Days left in (budgetYear, budgetMonth) by Israel civil date, counting today inclusive.
 * `null` if that month is entirely in the past relative to `now`.
 */
export function daysRemainingInBudgetMonth(
  now: Date,
  budgetYear: number,
  budgetMonth: number,
): number | null {
  const { year: cy, month: cm } = getIsraelYearMonth(now);
  const dim = daysInMonth(budgetYear, budgetMonth);
  if (budgetYear < cy || (budgetYear === cy && budgetMonth < cm)) {
    return null;
  }
  if (budgetYear > cy || (budgetYear === cy && budgetMonth > cm)) {
    return dim;
  }
  const day = getIsraelDayOfMonth(now);
  return Math.max(1, dim - day + 1);
}
