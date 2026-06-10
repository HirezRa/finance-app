import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  dashboardApi,
  transactionsApi,
  settingsApi,
  categoriesApi,
} from '@/services/api';
import type { HistoryItem } from '@/components/MonthlyComparisonChart';
import type { CategoryWithTargetStats } from '@/components/TrackedCategories';
import { getBudgetCycleLabelForIsraelDate, getIsraelYmd } from '@/lib/israel-calendar';
import { formatCurrency } from '@/lib/utils';
import type {
  AccountsOverview,
  CashFlowSummary,
  CategoryBreakdownRow,
  InstallmentsSummary,
  RecentTxn,
  WeeklyRow,
} from '../types';

type DashboardRange = 'day' | 'week' | 'cycle' | 'year' | 'all';
type TxCategory = {
  id?: string | null;
  name?: string;
  nameHe?: string;
  icon?: string;
  color?: string;
};
type DashboardTx = {
  id: string;
  date: string;
  amount: string | number;
  description: string;
  categoryId?: string | null;
  category?: TxCategory;
  account?: {
    institutionName?: string;
    nickname?: string | null;
    description?: string | null;
  };
};

function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseRangeFromQuery(v: string | null): DashboardRange {
  if (v === 'day' || v === 'week' || v === 'year' || v === 'all' || v === 'cycle') {
    return v;
  }
  return 'cycle';
}

const MONTH_NAMES_HE = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

export function formatBudgetCycleRange(
  budgetMonth: number,
  budgetYear: number,
  cycleStartDay: number,
): string {
  if (cycleStartDay <= 1) {
    return `${MONTH_NAMES_HE[budgetMonth - 1]} ${budgetYear}`;
  }
  const endMonth = budgetMonth === 12 ? 1 : budgetMonth + 1;
  const endYear = budgetMonth === 12 ? budgetYear + 1 : budgetYear;
  const endDay = cycleStartDay - 1;
  return `${cycleStartDay} ב${MONTH_NAMES_HE[budgetMonth - 1]} ${budgetYear} – ${endDay} ב${MONTH_NAMES_HE[endMonth - 1]} ${endYear}`;
}

export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function cycleDayProgress(
  month: number,
  year: number,
  cycleStartDay: number,
): { dayInCycle: number; daysInCycle: number; label: string } {
  const daysInCycle = 31;
  const current = getBudgetCycleLabelForIsraelDate(new Date(), cycleStartDay);
  const isCurrent = current.month === month && current.year === year;
  if (!isCurrent) {
    return { dayInCycle: 0, daysInCycle, label: `מחזור ${MONTH_NAMES_HE[month - 1]}` };
  }
  const now = getIsraelYmd(new Date());
  let dayInCycle = cycleStartDay <= 1 ? now.day : Math.max(1, now.day - cycleStartDay + 1);
  dayInCycle = Math.min(dayInCycle, daysInCycle);
  return {
    dayInCycle,
    daysInCycle,
    label: `יום ${dayInCycle}/${daysInCycle}`,
  };
}

export function useDashboardData() {
  const [searchParams] = useSearchParams();
  const selectedRange = parseRangeFromQuery(searchParams.get('range'));
  const calendarInitial = getBudgetCycleLabelForIsraelDate(new Date(), 1);
  const [month, setMonth] = useState(calendarInitial.month);
  const [year, setYear] = useState(calendarInitial.year);
  const appliedSettingsCycle = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      settingsApi
        .get()
        .then((res) => res.data as { budgetCycleStartDay?: number; monthlySavingsGoal?: number }),
  });

  useEffect(() => {
    if (appliedSettingsCycle.current || settings === undefined) return;
    appliedSettingsCycle.current = true;
    const csd = Number(settings.budgetCycleStartDay ?? 1);
    const { month: m, year: y } = getBudgetCycleLabelForIsraelDate(new Date(), csd);
    setMonth(m);
    setYear(y);
  }, [settings]);

  const rangeWindow = useMemo(() => {
    const now = new Date();
    const end = toIsoDateOnly(now);
    if (selectedRange === 'day') {
      return { startDate: end, endDate: end };
    }
    if (selectedRange === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      return { startDate: toIsoDateOnly(start), endDate: end };
    }
    if (selectedRange === 'year') {
      const y = getIsraelYmd(now).year;
      return { startDate: `${y}-01-01`, endDate: end };
    }
    if (selectedRange === 'all') {
      return { startDate: undefined, endDate: undefined };
    }
    return { startDate: undefined, endDate: undefined };
  }, [selectedRange]);

  const { data: summary, isPending: summaryLoading } = useQuery({
    queryKey: ['dashboard', 'summary', month, year],
    queryFn: () => dashboardApi.getSummary(month, year).then((res) => res.data as CashFlowSummary),
  });

  const { data: weekly, isPending: weeklyLoading } = useQuery({
    queryKey: ['dashboard', 'weekly', month, year],
    queryFn: () => dashboardApi.getWeekly(month, year).then((res) => res.data as WeeklyRow[]),
  });

  const { data: categories, isPending: categoriesLoading } = useQuery({
    queryKey: ['dashboard', 'categories', month, year],
    queryFn: () =>
      dashboardApi.getCategories(month, year).then((res) => res.data as CategoryBreakdownRow[]),
  });

  const { data: recent, isPending: recentLoading } = useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: () => dashboardApi.getRecent(10).then((res) => res.data as RecentTxn[]),
  });

  const { data: accounts, isPending: accountsLoading } = useQuery({
    queryKey: ['dashboard', 'accounts'],
    queryFn: () => dashboardApi.getAccounts().then((res) => res.data as AccountsOverview),
  });

  const { data: installments, isPending: installmentsLoading } = useQuery({
    queryKey: ['installments', 'summary'],
    queryFn: () =>
      transactionsApi.getInstallmentsSummary().then((res) => res.data as InstallmentsSummary),
  });

  const { data: historyData, isPending: historyLoading } = useQuery({
    queryKey: ['dashboard', 'history'],
    queryFn: () => dashboardApi.getHistory(6).then((res) => res.data as HistoryItem[]),
  });

  const { data: categoriesStatsRes, isPending: trackedCategoriesLoading } = useQuery({
    queryKey: ['categories', 'with-stats', 'dashboard-widget', month, year],
    queryFn: () => categoriesApi.getWithStats(month, year).then((res) => res.data),
  });

  const { data: rangeTransactions = [], isPending: rangeTransactionsLoading } = useQuery({
    queryKey: [
      'dashboard',
      'range-transactions',
      selectedRange,
      rangeWindow.startDate ?? null,
      rangeWindow.endDate ?? null,
    ],
    enabled: selectedRange !== 'cycle',
    queryFn: async () => {
      const all: DashboardTx[] = [];
      const limit = 500;
      let page = 1;
      let totalPages = 1;
      do {
        const res = await transactionsApi.getAll({
          page,
          limit,
          startDate: rangeWindow.startDate,
          endDate: rangeWindow.endDate,
          accountTypes: ['BANK', 'CREDIT_CARD'],
        });
        const payload = res.data as {
          data: DashboardTx[];
          pagination?: { totalPages?: number };
        };
        all.push(...(payload.data ?? []));
        totalPages = Math.max(1, Number(payload.pagination?.totalPages ?? 1));
        page += 1;
      } while (page <= totalPages && page <= 50);
      return all;
    },
  });

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  };

  const cycleStartDay = Number(
    settings?.budgetCycleStartDay ?? summary?.budgetCycleStartDay ?? 1,
  );

  const goToCurrentMonth = () => {
    const { month: m, year: y } = getBudgetCycleLabelForIsraelDate(new Date(), cycleStartDay);
    setMonth(m);
    setYear(y);
  };

  const currentCycle = getBudgetCycleLabelForIsraelDate(new Date(), cycleStartDay);
  const isCurrentMonth = month === currentCycle.month && year === currentCycle.year;
  const cyclePeriodTitle = formatBudgetCycleRange(month, year, cycleStartDay);
  const cycleProgress = cycleDayProgress(month, year, cycleStartDay);
  const useRangeData = selectedRange !== 'cycle';

  const rangeDerived = useMemo(() => {
    if (!useRangeData) {
      return null;
    }
    const txSorted = [...rangeTransactions].sort((a, b) => (a.date < b.date ? 1 : -1));
    const incomeTotal = txSorted
      .filter((t) => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const expensesTotal = txSorted
      .filter((t) => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const remaining = incomeTotal - expensesTotal;
    const monthlySavingsGoal = Number(settings?.monthlySavingsGoal ?? 0);
    const availableBalance = remaining - monthlySavingsGoal;

    const categoryMap = new Map<
      string,
      { categoryId: string | null; name: string; nameHe: string; icon: string; color: string; total: number; count: number }
    >();
    for (const t of txSorted) {
      const amount = Number(t.amount);
      if (amount >= 0) continue;
      const key = t.categoryId ?? t.category?.id ?? 'uncategorized';
      const row = categoryMap.get(key) ?? {
        categoryId: key === 'uncategorized' ? null : key,
        name: t.category?.name ?? 'uncategorized',
        nameHe: t.category?.nameHe ?? 'לא מסווג',
        icon: t.category?.icon ?? '❓',
        color: t.category?.color ?? '#6b7280',
        total: 0,
        count: 0,
      };
      row.total += Math.abs(amount);
      row.count += 1;
      categoryMap.set(key, row);
    }
    const categoryRows = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
    const grandTotal = categoryRows.reduce((sum, r) => sum + r.total, 0);
    const categories = categoryRows.map((r) => ({
      ...r,
      percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
    }));

    const weekMap = new Map<string, number>();
    for (const t of txSorted) {
      const amount = Number(t.amount);
      if (amount >= 0) continue;
      const d = new Date(t.date);
      const day = d.getUTCDay();
      const diffToMonday = (day + 6) % 7;
      d.setUTCDate(d.getUTCDate() - diffToMonday);
      d.setUTCHours(0, 0, 0, 0);
      const key = toIsoDateOnly(d);
      weekMap.set(key, (weekMap.get(key) ?? 0) + Math.abs(amount));
    }
    const weekly = Array.from(weekMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6)
      .map(([startDate, total], idx) => ({
        week: idx + 1,
        startDate,
        endDate: startDate,
        total,
      }));

    const periodTitle =
      selectedRange === 'day'
        ? 'היום'
        : selectedRange === 'week'
          ? '7 ימים אחרונים'
          : selectedRange === 'year'
            ? 'שנה נוכחית'
            : 'כל התקופה';

    return {
      summary: {
        month,
        year,
        income: { total: incomeTotal, fixed: 0, variable: incomeTotal },
        expenses: { total: expensesTotal, fixed: 0, tracked: 0, variable: expensesTotal },
        remaining,
        balance: remaining,
        availableBalance,
        monthlySavingsGoal,
        budgetCycleStartDay: cycleStartDay,
        transactionCount: txSorted.length,
      } as CashFlowSummary,
      weekly: weekly as WeeklyRow[],
      categories: categories as CategoryBreakdownRow[],
      recent: txSorted.slice(0, 10) as RecentTxn[],
      periodTitle,
      cycleProgress: {
        dayInCycle: txSorted.length > 0 ? Math.min(31, txSorted.length) : 1,
        daysInCycle: txSorted.length > 0 ? Math.min(31, txSorted.length) : 1,
        label: `${txSorted.length} עסקאות`,
      },
    };
  }, [
    useRangeData,
    rangeTransactions,
    selectedRange,
    settings?.monthlySavingsGoal,
    month,
    year,
    cycleStartDay,
  ]);

  const effectiveSummary = useRangeData ? rangeDerived?.summary : summary;
  const effectiveWeekly = useRangeData ? rangeDerived?.weekly : weekly;
  const effectiveCategories = useRangeData ? rangeDerived?.categories : categories;
  const effectiveRecent = useRangeData ? rangeDerived?.recent : recent;
  const periodTitle = useRangeData ? (rangeDerived?.periodTitle ?? 'טווח') : cyclePeriodTitle;
  const effectiveCycleProgress = useRangeData
    ? (rangeDerived?.cycleProgress ?? cycleProgress)
    : cycleProgress;

  const spendable = Number(
    effectiveSummary?.availableBalance ??
      effectiveSummary?.balance ??
      effectiveSummary?.remaining ??
      0,
  );
  const monthlyGoal = Number(effectiveSummary?.monthlySavingsGoal ?? 0);
  const expensesTotal = Number(effectiveSummary?.expenses?.total ?? 0);
  const incomeTotal = Number(effectiveSummary?.income?.total ?? 0);

  const dailyAllowance = useMemo(() => {
    const remainingDays = Math.max(
      1,
      effectiveCycleProgress.daysInCycle - effectiveCycleProgress.dayInCycle,
    );
    return spendable > 0 ? spendable / remainingDays : 0;
  }, [spendable, effectiveCycleProgress.dayInCycle, effectiveCycleProgress.daysInCycle]);

  const dailySpentApprox = useMemo(() => {
    if (effectiveCycleProgress.dayInCycle <= 0) return 0;
    return expensesTotal / effectiveCycleProgress.dayInCycle;
  }, [expensesTotal, effectiveCycleProgress.dayInCycle]);

  const dailyPacePct = useMemo(() => {
    if (dailyAllowance <= 0) return 0;
    return Math.min(100, Math.round((dailySpentApprox / dailyAllowance) * 100));
  }, [dailySpentApprox, dailyAllowance]);

  const budgetSpentPct = useMemo(() => {
    const cap = incomeTotal || expensesTotal || 1;
    return Math.min(100, Math.round((expensesTotal / cap) * 100));
  }, [expensesTotal, incomeTotal]);

  const savingsYtd = useMemo(() => {
    return (historyData ?? [])
      .filter((h) => h.year === year)
      .reduce((acc, h) => acc + Math.max(0, h.balance), 0);
  }, [historyData, year]);

  const savingsGoalAnnual = monthlyGoal > 0 ? monthlyGoal * 12 : 0;
  const savingsPct =
    savingsGoalAnnual > 0 ? Math.min(100, Math.round((savingsYtd / savingsGoalAnnual) * 100)) : 0;

  const weeklyTotals = (effectiveWeekly ?? []).map((w) => w.total);
  const weeklyMax = Math.max(...weeklyTotals, 1);

  const topCategories = (effectiveCategories ?? []).slice(0, 6);
  const trackedCategories: CategoryWithTargetStats[] =
    categoriesStatsRes?.categories ?? [];

  const mobileCategoryTiles = useMemo(() => {
    return trackedCategories
      .filter((c) => c.monthlyTarget != null && c.monthlyTarget > 0)
      .slice(0, 4)
      .map((c) => ({
        id: c.id,
        name: c.nameHe,
        display: Math.abs(c.spent).toLocaleString('en-US', { maximumFractionDigits: 0 }),
        pct: c.percentUsed ?? 0,
        over: c.isOverBudget,
      }));
  }, [trackedCategories]);

  const showFallback =
    !useRangeData &&
    summary &&
    (summary.usedFallback === true || summary.usedFallbackToLatestMonth === true);

  const isLoading =
    summaryLoading ||
    weeklyLoading ||
    categoriesLoading ||
    recentLoading ||
    accountsLoading ||
    (useRangeData && rangeTransactionsLoading);

  return {
    month,
    year,
    changeMonth,
    goToCurrentMonth,
    isCurrentMonth: useRangeData ? true : isCurrentMonth,
    selectedRange,
    periodTitle,
    periodShort: `${String(month).padStart(2, '0')}.${year}`,
    cycleProgress: effectiveCycleProgress,
    cycleStartDay,
    summary: effectiveSummary,
    weekly: effectiveWeekly,
    categories: effectiveCategories,
    recent: effectiveRecent,
    accounts,
    installments,
    historyData,
    trackedCategories,
    mobileCategoryTiles,
    topCategories,
    spendable,
    spendableFormatted: formatCurrency(spendable),
    incomeTotal,
    expensesTotal,
    monthlyGoal,
    dailyAllowance,
    dailySpentApprox,
    dailyPacePct,
    budgetSpentPct,
    savingsYtd,
    savingsGoalAnnual,
    savingsPct,
    weeklyTotals,
    weeklyMax,
    showFallback,
    isLoading,
    summaryLoading,
    weeklyLoading,
    categoriesLoading,
    recentLoading,
    accountsLoading,
    installmentsLoading,
    historyLoading,
    trackedCategoriesLoading,
    formatCurrency,
    num,
  };
}

export type DashboardData = ReturnType<typeof useDashboardData>;
