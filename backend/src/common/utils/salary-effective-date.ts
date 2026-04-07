import {
  getIsraelDayOfMonth,
  getIsraelYearMonth,
  startOfIsraelMonthDay,
} from './israel-calendar';

export function clampSalaryRange(start: number, end: number): {
  start: number;
  end: number;
} {
  let s = start;
  let e = end;
  if (s < 1 || s > 31) s = 25;
  if (e < 1 || e > 31) e = 31;
  if (e < s) {
    return { start: 25, end: 31 };
  }
  return { start: s, end: e };
}

/** תאריך אפקטיבי לחודש הבא (יום 1 ישראלי) או null אם לא במסלול משכורת */
export function computeSalaryEffectiveDateForBankDate(
  bankDate: Date,
  isIncomeCategory: boolean,
  salaryStartDay: number,
  salaryEndDay: number,
): Date | null {
  if (!isIncomeCategory) {
    return null;
  }

  const { start, end } = clampSalaryRange(salaryStartDay, salaryEndDay);
  const dom = getIsraelDayOfMonth(bankDate);
  if (dom < start || dom > end) {
    return null;
  }

  const { year: iy, month: im } = getIsraelYearMonth(bankDate);
  let nm = im + 1;
  let ny = iy;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return startOfIsraelMonthDay(ny, nm, 1);
}
