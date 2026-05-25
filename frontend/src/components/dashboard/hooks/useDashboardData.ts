import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const calendarInitial = getBudgetCycleLabelForIsraelDate(new Date(), 1);
  const [month, setMonth] = useState(calendarInitial.month);
  const [year, setYear] = useState(calendarInitial.year);
  const appliedSettingsCycle = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      settingsApi.get().then((res) => res.data as { budgetCycleStartDay?: number }),
  });

  useEffect(() => {
    if (appliedSettingsCycle.current || settings === undefined) return;
    appliedSettingsCycle.current = true;
    const csd = Number(settings.budgetCycleStartDay ?? 1);
    const { month: m, year: y } = getBudgetCycleLabelForIsraelDate(new Date(), csd);
    setMonth(m);
    setYear(y);
  }, [settings]);

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
  const periodTitle = formatBudgetCycleRange(month, year, cycleStartDay);
  const cycleProgress = cycleDayProgress(month, year, cycleStartDay);

  const spendable = Number(
    summary?.availableBalance ?? summary?.balance ?? summary?.remaining ?? 0,
  );
  const monthlyGoal = Number(summary?.monthlySavingsGoal ?? 0);
  const expensesTotal = Number(summary?.expenses?.total ?? 0);
  const incomeTotal = Number(summary?.income?.total ?? 0);

  const dailyAllowance = useMemo(() => {
    const remainingDays = Math.max(1, cycleProgress.daysInCycle - cycleProgress.dayInCycle);
    return spendable > 0 ? spendable / remainingDays : 0;
  }, [spendable, cycleProgress.dayInCycle, cycleProgress.daysInCycle]);

  const dailySpentApprox = useMemo(() => {
    if (cycleProgress.dayInCycle <= 0) return 0;
    return expensesTotal / cycleProgress.dayInCycle;
  }, [expensesTotal, cycleProgress.dayInCycle]);

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

  const weeklyTotals = (weekly ?? []).map((w) => w.total);
  const weeklyMax = Math.max(...weeklyTotals, 1);

  const topCategories = (categories ?? []).slice(0, 6);
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
    summary &&
    (summary.usedFallback === true || summary.usedFallbackToLatestMonth === true);

  const isLoading =
    summaryLoading ||
    weeklyLoading ||
    categoriesLoading ||
    recentLoading ||
    accountsLoading;

  return {
    month,
    year,
    changeMonth,
    goToCurrentMonth,
    isCurrentMonth,
    periodTitle,
    periodShort: `${String(month).padStart(2, '0')}.${year}`,
    cycleProgress,
    cycleStartDay,
    summary,
    weekly,
    categories,
    recent,
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
