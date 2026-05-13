import {
  cashFlowAnchorDateForTxn,
  computeSalaryEffectiveDateForBankDate,
} from './salary-effective-date';

describe('computeSalaryEffectiveDateForBankDate', () => {
  it('does not shift early-month bank day even if salary range includes day 1 (e.g. 1–31)', () => {
    const bank = new Date('2026-05-01T12:00:00.000Z');
    expect(computeSalaryEffectiveDateForBankDate(bank, true, 1, 31)).toBeNull();
  });

  it('shifts late-month salary in default 25–31 window to next month', () => {
    const bank = new Date('2026-05-28T12:00:00.000Z');
    const eff = computeSalaryEffectiveDateForBankDate(bank, true, 25, 31);
    expect(eff).not.toBeNull();
    expect(eff!.getUTCFullYear()).toBe(2026);
    expect(eff!.getUTCMonth() + 1).toBe(6);
    expect(eff!.getUTCDate()).toBe(1);
  });

  it('returns null for non-income category', () => {
    const bank = new Date('2026-05-28T12:00:00.000Z');
    expect(computeSalaryEffectiveDateForBankDate(bank, false, 25, 31)).toBeNull();
  });
});

describe('cashFlowAnchorDateForTxn', () => {
  it('uses bank date for income on Israel day 1–14 even if legacy effectiveDate points to next month', () => {
    const date = new Date('2026-05-01T12:00:00.000Z');
    const effectiveDate = new Date('2026-06-01T12:00:00.000Z');
    const anchor = cashFlowAnchorDateForTxn({
      date,
      effectiveDate,
      category: { isIncome: true },
    });
    expect(anchor.getTime()).toBe(date.getTime());
  });

  it('keeps effectiveDate for income on Israel day 28 in salary window (late-month shift)', () => {
    const date = new Date('2026-05-28T12:00:00.000Z');
    const effectiveDate = new Date('2026-06-01T12:00:00.000Z');
    const anchor = cashFlowAnchorDateForTxn({
      date,
      effectiveDate,
      category: { isIncome: true },
    });
    expect(anchor.getTime()).toBe(effectiveDate.getTime());
  });

  it('uses effectiveDate for non-income when set', () => {
    const date = new Date('2026-05-02T12:00:00.000Z');
    const effectiveDate = new Date('2026-06-01T12:00:00.000Z');
    const anchor = cashFlowAnchorDateForTxn({
      date,
      effectiveDate,
      category: { isIncome: false },
    });
    expect(anchor.getTime()).toBe(effectiveDate.getTime());
  });
});
