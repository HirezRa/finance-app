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
