import { normalizeScraperDateFromRaw } from './scraper-date-normalize';

describe('normalizeScraperDateFromRaw', () => {
  it('matches Israel civil day for UTC evening before May 1 Israel', () => {
    const sem = normalizeScraperDateFromRaw('2026-04-30T21:00:00.000Z');
    expect(sem.ymdIso).toBe('2026-05-01');
  });
});
