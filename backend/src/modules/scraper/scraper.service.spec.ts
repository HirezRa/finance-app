import { ScraperService } from './scraper.service';

/**
 * detectCoverageAnomaly is private — invoke via cast. The behaviour we lock in:
 *   1. Scraper-emitted `partial:true` always surfaces as isAnomalous (even on short windows),
 *      so verify scripts / sync logs can flag a bad scrape that the local heuristic would miss.
 *   2. Yahav narrow-window heuristic still fires for the original "wide ask, sparse return" case.
 *   3. Healthy coverage stays clean.
 *
 * These cases mirror the Yahav 01/05 RCA: the user requests ~22 days back (verify script) or
 * ~180 days back (production) and Yahav returns only 5 rows from the last week.
 */
type CoverageInputs = {
  companyId: string;
  requestedStartDate: Date;
  accounts: Array<{ txns?: Array<{ date?: unknown }> }>;
  scraperPartial?: boolean;
  scraperWarnings?: string[];
  scraperDiagnostics?: Record<string, unknown>;
};

function callDetect(inputs: CoverageInputs) {
  const service = Object.create(ScraperService.prototype) as ScraperService;
  return (service as unknown as { detectCoverageAnomaly: (p: CoverageInputs) => unknown })
    .detectCoverageAnomaly(inputs);
}

const fixedNow = Date.UTC(2026, 4, 17, 6, 0, 0, 0);

describe('ScraperService.detectCoverageAnomaly', () => {
  let nowSpy: jest.SpyInstance;

  beforeAll(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterAll(() => {
    nowSpy.mockRestore();
  });

  it('treats bankHistoryTruncated as non-anomalous even when scraper signaled partial', () => {
    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2025, 10, 19)),
      accounts: [
        {
          txns: Array.from({ length: 28 }, (_, i) => ({
            date: new Date(Date.UTC(2026, 3, 1 + (i % 28))).toISOString(),
          })),
        },
      ],
      scraperPartial: false,
      scraperWarnings: [
        'Yahav bank history truncated: requestedStartDate=2026-02-18, bankAvailableFrom=2026-04-01.',
      ],
      scraperDiagnostics: {
        requestedStartDate: '2026-02-18',
        bankAvailableFrom: '2026-04-01',
        bankHistoryTruncated: true,
        requestedVsBankGapDays: 42,
        minTxnDate: '2026-04-01',
        maxTxnDate: '2026-05-18',
        txnsCount: 28,
        coverageGapDays: 0,
      },
    }) as { isAnomalous: boolean; stats: { bankHistoryTruncated: boolean; gapDays: number | null } };

    expect(result.isAnomalous).toBe(false);
    expect(result.stats.bankHistoryTruncated).toBe(true);
    expect(result.stats.gapDays).toBe(0);
  });

  it('returns anomalous=true when scraper itself reports partial, even on a short window', () => {
    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2026, 3, 25)),
      accounts: [
        {
          txns: [
            { date: '2026-05-09T21:00:00.000Z' },
            { date: '2026-05-10T21:00:00.000Z' },
            { date: '2026-05-11T21:00:00.000Z' },
            { date: '2026-05-12T21:00:00.000Z' },
            { date: '2026-05-13T21:00:00.000Z' },
          ],
        },
      ],
      scraperPartial: true,
      scraperWarnings: ['yahav_coverage_suspicious gapDays=14 count=5'],
      scraperDiagnostics: {
        requestedStartDate: '2026-04-25',
        minTxnDate: '2026-05-09',
        maxTxnDate: '2026-05-13',
        txnsCount: 5,
        coverageGapDays: 14,
      },
    }) as { isAnomalous: boolean; reason?: string; stats: Record<string, unknown> };

    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/scraper_signaled_partial|coverage_gap_detected/);
    expect(result.stats.scraperPartial).toBe(true);
    expect(result.stats.txnsCount).toBe(5);
    expect(result.stats.scraperWarnings).toEqual([
      'yahav_coverage_suspicious gapDays=14 count=5',
    ]);
  });

  it('still detects classic Yahav narrow-window anomaly without scraper.partial', () => {
    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2026, 0, 1)),
      accounts: [
        {
          txns: [
            { date: '2026-05-10T21:00:00.000Z' },
            { date: '2026-05-11T21:00:00.000Z' },
            { date: '2026-05-12T21:00:00.000Z' },
            { date: '2026-05-13T21:00:00.000Z' },
          ],
        },
      ],
    }) as { isAnomalous: boolean; reason?: string; stats: { txnsCount: number } };

    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/coverage_gap_detected/);
    expect(result.stats.txnsCount).toBe(4);
  });

  it('treats healthy coverage as not anomalous (sufficient rows across a wide window)', () => {
    const txns: Array<{ date: string }> = [];
    for (let d = 25; d <= 31; d += 1) {
      txns.push({ date: `2026-04-${d}T08:00:00.000Z` });
    }
    for (let d = 1; d <= 16; d += 1) {
      const dd = String(d).padStart(2, '0');
      txns.push({ date: `2026-05-${dd}T08:00:00.000Z` });
    }

    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2026, 3, 25)),
      accounts: [{ txns }],
    }) as { isAnomalous: boolean; stats: { txnsCount: number } };

    expect(result.isAnomalous).toBe(false);
    expect(result.stats.txnsCount).toBe(txns.length);
  });

  it('zero-rows-with-no-partial-signal stays non-anomalous (no false alarm)', () => {
    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2026, 4, 1)),
      accounts: [{ txns: [] }],
    }) as { isAnomalous: boolean; stats: { txnsCount: number } };

    expect(result.isAnomalous).toBe(false);
    expect(result.stats.txnsCount).toBe(0);
  });

  it('zero-rows + scraper.partial=true is treated as anomalous (broken sync surfaced)', () => {
    const result = callDetect({
      companyId: 'yahav',
      requestedStartDate: new Date(Date.UTC(2026, 4, 1)),
      accounts: [{ txns: [] }],
      scraperPartial: true,
      scraperWarnings: ['no_transactions'],
    }) as { isAnomalous: boolean; reason?: string; stats: Record<string, unknown> };

    expect(result.isAnomalous).toBe(true);
    expect(result.reason).toMatch(/scraper_signaled_partial_with_no_transactions/);
    expect(result.stats.scraperPartial).toBe(true);
  });
});
