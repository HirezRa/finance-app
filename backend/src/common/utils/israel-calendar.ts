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
