/** Calendar month/year in Asia/Jerusalem for a Date (typically `new Date()`). */
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

/** Israel civil day for a UTC instant (Asia/Jerusalem). */
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

/**
 * Budget cycle label (month/year) for a date — mirrors backend `getBudgetCycleLabelForIsraelDate`.
 * `cycleStartDay === 1`: Israel calendar month. Otherwise cycle runs from startDay of `month` through (startDay-1) of following month.
 */
export function getBudgetCycleLabelForIsraelDate(
  date: Date,
  cycleStartDay: number,
): { year: number; month: number } {
  if (cycleStartDay <= 1) {
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
