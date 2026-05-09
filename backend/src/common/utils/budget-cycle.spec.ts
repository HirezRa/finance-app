import {
  clampBudgetCycleStartDay,
  getBudgetCycleLabelForIsraelDate,
  isInBudgetCycle,
  listBudgetCycleDays,
} from './budget-cycle';

describe('clampBudgetCycleStartDay', () => {
  it('normalizes invalid values to 1–31', () => {
    expect(clampBudgetCycleStartDay(NaN)).toBe(1);
    expect(clampBudgetCycleStartDay(0)).toBe(1);
    expect(clampBudgetCycleStartDay(-3)).toBe(1);
    expect(clampBudgetCycleStartDay(10)).toBe(10);
    expect(clampBudgetCycleStartDay(31)).toBe(31);
    expect(clampBudgetCycleStartDay(50)).toBe(31);
  });
});

describe('isInBudgetCycle', () => {
  /** Instant that reads as the given Israel civil day (Asia/Jerusalem). */
  const atIsrael = (isoLocalNoon: string) => new Date(isoLocalNoon);

  describe('cycleStartDay = 10 (spill through day 9 of next month)', () => {
    it('includes June 9 in May-2026 budget cycle', () => {
      expect(
        isInBudgetCycle(atIsrael('2026-06-09T12:00:00+03:00'), 2026, 5, 10),
      ).toBe(true);
    });

    it('excludes June 10 from May-2026 budget cycle', () => {
      expect(
        isInBudgetCycle(atIsrael('2026-06-10T12:00:00+03:00'), 2026, 5, 10),
      ).toBe(false);
    });

    it('includes May 10 start of May-2026 cycle', () => {
      expect(
        isInBudgetCycle(atIsrael('2026-05-10T12:00:00+03:00'), 2026, 5, 10),
      ).toBe(true);
    });
  });

  describe('cycleStartDay = 5 (spill through day 4 of next month)', () => {
    it('includes June 4 in May-2026 cycle', () => {
      expect(
        isInBudgetCycle(atIsrael('2026-06-04T12:00:00+03:00'), 2026, 5, 5),
      ).toBe(true);
    });

    it('excludes June 5 from May-2026 cycle', () => {
      expect(
        isInBudgetCycle(atIsrael('2026-06-05T12:00:00+03:00'), 2026, 5, 5),
      ).toBe(false);
    });
  });
});

describe('getBudgetCycleLabelForIsraelDate', () => {
  it('maps early-month dates to previous cycle when startDay is 10', () => {
    const label = getBudgetCycleLabelForIsraelDate(
      new Date('2026-05-09T12:00:00+03:00'),
      10,
    );
    expect(label).toEqual({ year: 2026, month: 4 });
  });
});

describe('listBudgetCycleDays', () => {
  it('lists spill days 1..N-1 in following month for N>1', () => {
    const days = listBudgetCycleDays(2026, 5, 5);
    const spill = days.filter((x) => x.m === 6 && x.y === 2026);
    expect(spill.map((x) => x.d)).toEqual([1, 2, 3, 4]);
  });
});
