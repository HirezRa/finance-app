import {
  endOfIsraelCivilDayInUtc,
  getIsraelYmd,
  parseIsoYmdParts,
  startOfIsraelCivilDayInUtc,
} from './israel-calendar';

/**
 * Simulates GET /transactions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * when the service uses Israel civil-day bounds (strict ISO date only).
 */
function buildIsraelMonthDbRange(startYmd: string, endYmd: string): {
  gte: Date;
  lte: Date;
} {
  const s = parseIsoYmdParts(startYmd);
  const e = parseIsoYmdParts(endYmd);
  return {
    gte: startOfIsraelCivilDayInUtc(s.year, s.month, s.day),
    lte: endOfIsraelCivilDayInUtc(e.year, e.month, e.day),
  };
}

function inDbRange(txUtc: Date, gte: Date, lte: Date): boolean {
  const t = txUtc.getTime();
  return t >= gte.getTime() && t <= lte.getTime();
}

describe('May 2026 — simulated bank timestamps vs Israel month query', () => {
  const may2026 = buildIsraelMonthDbRange('2026-05-01', '2026-05-31');

  it('includes Israel midnight May 1 (UTC still April 30 evening) — common payroll post', () => {
    const bankUtc = new Date('2026-04-30T21:00:00.000Z');
    expect(getIsraelYmd(bankUtc)).toEqual({ year: 2026, month: 5, day: 1 });
    expect(inDbRange(bankUtc, may2026.gte, may2026.lte)).toBe(true);
  });

  it('would be excluded by naive new Date("2026-05-01") lower bound (documents the bug)', () => {
    const naiveLower = new Date('2026-05-01');
    const bankUtc = new Date('2026-04-30T21:00:00.000Z');
    expect(bankUtc.getTime() >= naiveLower.getTime()).toBe(false);
  });

  it('includes noon UTC May 1 (still May 1 in Israel)', () => {
    const bankUtc = new Date('2026-05-01T12:00:00.000Z');
    expect(getIsraelYmd(bankUtc)).toEqual({ year: 2026, month: 5, day: 1 });
    expect(inDbRange(bankUtc, may2026.gte, may2026.lte)).toBe(true);
  });

  it('excludes last instant of April 30 Israel', () => {
    const bankUtc = new Date('2026-04-30T20:59:59.999Z');
    expect(getIsraelYmd(bankUtc).month).toBe(4);
    expect(inDbRange(bankUtc, may2026.gte, may2026.lte)).toBe(false);
  });

  it('end of May Israel connects to start of June Israel (no gap)', () => {
    const endMay = endOfIsraelCivilDayInUtc(2026, 5, 31);
    const startJune = startOfIsraelCivilDayInUtc(2026, 6, 1);
    expect(endMay.getTime() + 1).toBe(startJune.getTime());
  });
});
