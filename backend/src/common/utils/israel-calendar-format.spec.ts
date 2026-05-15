import {
  formatIsraelYmdIso,
  getIsraelYmd,
  startOfIsraelCivilDayInUtc,
} from './israel-calendar';

describe('formatIsraelYmdIso (scraper / bank UTC instants)', () => {
  it('uses Israel civil date, not UTC calendar slice (May 1 starts previous UTC day in summer)', () => {
    const crossUtcMidnight = new Date('2026-04-30T21:00:00.000Z');
    expect(formatIsraelYmdIso(crossUtcMidnight)).toBe('2026-05-01');
    const { day } = getIsraelYmd(crossUtcMidnight);
    expect(day).toBe(1);
  });

  it('aligns stored row anchor with startOfIsraelCivilDayInUtc for that Y-M-D', () => {
    const t = new Date('2026-05-07T15:30:00.000+03:00');
    const { year, month, day } = getIsraelYmd(t);
    expect(formatIsraelYmdIso(t)).toBe('2026-05-07');
    expect(startOfIsraelCivilDayInUtc(year, month, day).getTime()).toBeLessThanOrEqual(
      t.getTime(),
    );
  });
});
