import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, transactionsApi, settingsApi, categoriesApi } from '@/services/api';
import { MonthlyComparisonChart } from '@/components/MonthlyComparisonChart';
import type { HistoryItem } from '@/components/MonthlyComparisonChart';
import { TrackedCategories } from '@/components/TrackedCategories';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatShortDate, cn } from '@/lib/utils';
import { Amount } from '@/components/Amount';
import { getAccountDisplayName } from '@/lib/accountDisplay';
import { getBudgetCycleLabelForIsraelDate } from '@/lib/israel-calendar';
import { TransactionCategoryBadge } from '@/components/TransactionCategoryBadge';
import {
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  PiggyBank,
  Calendar,
  Globe,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
} from 'recharts';

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

interface CashFlowSummary {
  month: number;
  year: number;
  usedFallbackToLatestMonth?: boolean;
  usedFallback?: boolean;
  income: { total: number; fixed: number; variable: number };
  expenses: {
    total: number;
    fixed: number;
    tracked: number;
    variable: number;
  };
  remaining: number;
  balance?: number;
  availableBalance?: number;
  monthlySavingsGoal?: number;
  budgetCycleStartDay?: number;
  transactionCount: number;
  abroad?: {
    totalSpentILS: number;
    transactionCount: number;
    byCurrency: Array<{
      currency: string;
      totalILS: number;
      totalOriginal: number;
      count: number;
    }>;
  };
}

interface WeeklyRow {
  week: number;
  startDate: string;
  endDate: string;
  total: number;
}

interface CategoryBreakdownRow {
  categoryId: string | null;
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  total: number;
  count: number;
  percentage: number;
}

interface RecentTxn {
  id: string;
  date: string;
  amount: string | number;
  description: string;
  categoryId?: string | null;
  account?: {
    institutionName?: string;
    nickname?: string | null;
    description?: string | null;
  };
  category?: {
    id?: string | null;
    name?: string;
    nameHe?: string;
    icon?: string;
    color?: string;
  };
  isUncategorized?: boolean;
}

interface AccountsOverview {
  accounts: Array<{
    id: string;
    institutionName: string;
    accountNumber: string;
    balance: string | number | null;
    nickname?: string | null;
    description?: string | null;
  }>;
  totalBalance: number;
  count: number;
}

interface InstallmentsSummary {
  activeCount: number;
  totalMonthly: number;
  totalRemaining: number;
  details: Array<{
    description: string;
    monthlyAmount: number;
    currentPayment: number | null;
    totalPayments: number | null;
    remainingPayments: number;
    totalPaid: number;
    remainingAmount: number;
  }>;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function formatBudgetCycleRange(
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

export default function DashboardPage() {
  const calendarInitial = getBudgetCycleLabelForIsraelDate(new Date(), 1);
  const [month, setMonth] = useState(calendarInitial.month);
  const [year, setYear] = useState(calendarInitial.year);
  const appliedSettingsCycle = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => settingsApi.get().then((res) => res.data as { budgetCycleStartDay?: number }),
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

  const { data: categories } = useQuery({
    queryKey: ['dashboard', 'categories', month, year],
    queryFn: () =>
      dashboardApi.getCategories(month, year).then((res) => res.data as CategoryBreakdownRow[]),
  });

  const { data: recent } = useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: () => dashboardApi.getRecent(10).then((res) => res.data as RecentTxn[]),
  });

  const { data: accounts } = useQuery({
    queryKey: ['dashboard', 'accounts'],
    queryFn: () => dashboardApi.getAccounts().then((res) => res.data as AccountsOverview),
  });

  const { data: installments } = useQuery({
    queryKey: ['installments', 'summary'],
    queryFn: () =>
      transactionsApi.getInstallmentsSummary().then((res) => res.data as InstallmentsSummary),
  });

  const { data: historyData, isPending: historyLoading } = useQuery({
    queryKey: ['dashboard', 'history'],
    queryFn: () =>
      dashboardApi.getHistory(6).then((res) => res.data as HistoryItem[]),
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
  const nonCalendarCycle = cycleStartDay > 1;

  const goToCurrentMonth = () => {
    const { month: m, year: y } = getBudgetCycleLabelForIsraelDate(
      new Date(),
      cycleStartDay,
    );
    setMonth(m);
    setYear(y);
  };

  const currentCycle = getBudgetCycleLabelForIsraelDate(new Date(), cycleStartDay);
  const isCurrentMonth =
    month === currentCycle.month && year === currentCycle.year;
  const periodTitle = formatBudgetCycleRange(month, year, cycleStartDay);
  const showFallback =
    summary &&
    (summary.usedFallback === true || summary.usedFallbackToLatestMonth === true);

  const topCategories = (categories ?? []).slice(0, 6);

  const monthlyGoal = Number(summary?.monthlySavingsGoal ?? 0);
  const hasSavingsGoal = monthlyGoal > 0;
  const spendable = Number(
    summary?.availableBalance ?? summary?.balance ?? summary?.remaining ?? 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">לוח בקרה</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>{nonCalendarCycle ? 'מחזור תקציב:' : 'סיכום חודשי:'}</span>
            {nonCalendarCycle ? (
              <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-xs text-foreground">
                <Calendar className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                <span className="leading-snug">{periodTitle}</span>
              </span>
            ) : (
              <span className="font-medium text-foreground">{periodTitle}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCurrentMonth ? (
            <Button type="button" variant="outline" size="sm" onClick={goToCurrentMonth}>
              <RefreshCw className="ms-2 h-4 w-4" />
              {nonCalendarCycle ? 'מחזור נוכחי' : 'חודש נוכחי'}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="min-w-[10rem] max-w-[20rem] text-center text-sm font-medium leading-snug sm:text-base">
            {periodTitle}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {!summaryLoading && summary ? (
        <div className="finance-card-elevated relative overflow-hidden border border-white/25 bg-gradient-to-br from-indigo-600/90 via-primary/85 to-indigo-800/90 text-primary-foreground shadow-[0_12px_48px_rgba(79,70,229,0.35)] backdrop-blur-md">
          <div
            className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-24 -start-12 h-40 w-40 rounded-full bg-indigo-400/25 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="space-y-1">
              <p className="text-sm text-primary-foreground/80">יתרה זמינה</p>
              <Amount
                value={spendable}
                size="hero"
                showSign={false}
                className="text-primary-foreground"
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-primary-foreground/20 pt-4">
              <div>
                <p className="text-xs text-primary-foreground/70">הכנסות החודש</p>
                <Amount
                  value={Number(summary.income?.total ?? 0)}
                  size="lg"
                  showSign={false}
                  className="text-primary-foreground"
                />
              </div>
              <div>
                <p className="text-xs text-primary-foreground/70">הוצאות החודש</p>
                <Amount
                  value={-Number(summary.expenses?.total ?? 0)}
                  size="lg"
                  className="text-primary-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      ) : summaryLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : null}

      {showFallback && summary ? (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-500">
                מוצגים נתונים מ
                {formatBudgetCycleRange(summary.month, summary.year, cycleStartDay)}
              </p>
              <p className="text-sm text-muted-foreground">
                {nonCalendarCycle
                  ? 'אין עסקאות במחזור שנבחר — שימוש בנתוני מחזור אחרון עם פעילות.'
                  : 'אין עסקאות בחודש שנבחר — שימוש בנתוני חודש אחרון עם פעילות.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {summary?.transactionCount === 0 && !summaryLoading ? (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-600 dark:text-yellow-500">
                {nonCalendarCycle ? 'אין עסקאות במחזור זה' : 'אין עסקאות בחודש זה'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isCurrentMonth
                  ? 'העסקאות יופיעו לאחר סנכרון הבנק'
                  : nonCalendarCycle
                    ? 'ניתן לנווט למחזור אחר לראות נתונים'
                    : 'ניתן לנווט לחודש אחר לראות נתונים'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">הכנסות החודש</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-24" />
                ) : (
                  <Amount
                    value={Number(summary?.income?.total ?? 0)}
                    size="2xl"
                    showSign={false}
                  />
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-income/15">
                <TrendingUp className="h-6 w-6 text-income" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">הוצאות החודש</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-24" />
                ) : (
                  <Amount
                    value={-Number(summary?.expenses?.total ?? 0)}
                    size="2xl"
                  />
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-expense/15">
                <TrendingDown className="h-6 w-6 text-expense" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {hasSavingsGoal ? 'יתרה גולמית' : 'יתרה חודשית'}
                </p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-24" />
                ) : (
                  <Amount value={Number(summary?.remaining ?? 0)} size="2xl" showSign={false} />
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">עסקאות החודש</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">{summary?.transactionCount ?? 0}</p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                <CreditCard className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!summaryLoading && summary?.abroad && summary.abroad.transactionCount > 0 ? (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
              הוצאות מחו״ל במחזור
            </CardTitle>
            <CardDescription>
              סה״כ בשקלים לפי חיוב בכרטיס; פירוט לפי מטבע מקורי מהבנק
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">סה״כ הוצאות חו״ל</span>
              <Amount
                value={-Number(summary.abroad.totalSpentILS)}
                size="xl"
                className="font-semibold"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.abroad.transactionCount} עסקאות · לפי מטבע מקורי:
            </p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {summary.abroad.byCurrency.map((row) => (
                <li
                  key={row.currency}
                  className="rounded-md border border-border bg-background/80 px-2 py-1 tabular-nums"
                >
                  <span className="font-medium">{row.currency}</span>
                  {row.totalOriginal > 0 ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {row.totalOriginal.toFixed(2)} →{' '}
                    </span>
                  ) : (
                    <span className="text-muted-foreground"> · </span>
                  )}
                  <span dir="ltr" className="inline-block">
                    <Amount value={-row.totalILS} size="sm" showSign={false} />
                  </span>
                  <span className="text-muted-foreground"> ({row.count})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {hasSavingsGoal && !summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    יעד חיסכון חודשי
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-500">
                    {formatCurrency(monthlyGoal)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    סכום זה מופחת מיתרה זמינה להוצאות
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                  <PiggyBank className="h-6 w-6 text-green-600 dark:text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נשאר להוציא</p>
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      spendable >= 0 ? 'text-green-500' : 'text-red-500',
                    )}
                  >
                    {formatCurrency(spendable)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    אחרי יעד חיסכון של {formatCurrency(monthlyGoal)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                  <Wallet className="h-6 w-6 text-amber-600 dark:text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {installments && installments.activeCount > 0 ? (
        <div className="finance-card">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">תשלומים פעילים</h3>
              <p className="text-sm text-muted-foreground">
                {installments.activeCount} מסלולי תשלומים מזוהים
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-muted/30 p-3">
            <div>
              <p className="text-sm text-muted-foreground">
                חיוב חודשי (סכום תשלומים):
              </p>
              <p className="font-semibold text-expense">
                <Amount value={-installments.totalMonthly} showSign={false} />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">הערכת נותר לתשלום:</p>
              <p className="font-semibold">
                <Amount
                  value={installments.totalRemaining}
                  showSign={false}
                  className="text-foreground"
                />
              </p>
            </div>
          </div>

          {installments.details.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="w-[45%] py-2 text-right font-medium">תיאור</th>
                    <th className="w-[20%] py-2 text-center font-medium">תשלום</th>
                    <th className="w-[35%] py-2 text-left font-medium" dir="ltr">
                      סכום
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {installments.details.slice(0, 5).map((item, i) => (
                    <tr
                      key={`${item.description}-${i}`}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="py-2.5 text-right">
                        <span
                          className="block max-w-full truncate font-medium"
                          title={item.description}
                        >
                          {item.description}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {item.currentPayment ?? '?'}/{item.totalPayments ?? '?'}
                        </span>
                      </td>
                      <td className="py-2.5 text-left" dir="ltr">
                        <Amount
                          value={-item.monthlyAmount}
                          size="sm"
                          showSign={false}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-muted-foreground">אין תשלומים פעילים</p>
          )}

          {installments.details.length > 5 ? (
            <div className="mt-3 border-t border-border pt-3 text-center">
              <Link
                to="/transactions"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'inline-flex')}
              >
                הצג את כל התשלומים ({installments.details.length})
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>הוצאות שבועיות</CardTitle>
            <CardDescription>לפי שבועות ב{periodTitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {weeklyLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : weekly && weekly.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={weekly}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="dashWeeklyExpense" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} />
                    </linearGradient>
                    <linearGradient id="dashWeeklyNeutral" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => formatCurrency(Number(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="week"
                    width={56}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `שבוע ${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      color: 'rgba(255,255,255,0.95)',
                    }}
                    formatter={(value) =>
                      typeof value === 'number'
                        ? [formatCurrency(value), 'סה״כ']
                        : [String(value ?? ''), 'סה״כ']
                    }
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as WeeklyRow | undefined;
                      return p
                        ? `${formatShortDate(p.startDate)}–${formatShortDate(p.endDate)}`
                        : '';
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {weekly.map((entry) => (
                      <Cell
                        key={entry.week}
                        fill={
                          entry.total > 0 ? 'url(#dashWeeklyExpense)' : 'url(#dashWeeklyNeutral)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                אין נתונים להצגה
              </div>
            )}
          </CardContent>
        </Card>

        {topCategories.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>הוצאות לפי קטגוריה</CardTitle>
              <CardDescription>{periodTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="finance-card flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
                <div className="mx-auto h-40 w-40 shrink-0 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topCategories.map((c) => ({
                          name: c.nameHe,
                          value: c.total,
                          color: c.color || '#64748b',
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {topCategories.map((c) => (
                          <Cell
                            key={c.categoryId ?? c.nameHe}
                            fill={c.color || '#64748b'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          typeof value === 'number' ? formatCurrency(value) : String(value ?? '')
                        }
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '12px',
                          color: 'rgba(255,255,255,0.95)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {topCategories.map((cat) => (
                    <div
                      key={cat.categoryId ?? cat.nameHe}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: cat.color || '#64748b' }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{cat.nameHe}</span>
                      <Amount value={-Math.abs(cat.total)} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>עסקאות אחרונות</CardTitle>
            <CardDescription>עדכון לפי תאריך</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recent?.slice(0, 5).map((txn) => {
                const amount = num(txn.amount);
                return (
                  <div key={txn.id} className="flex items-center gap-4 p-4">
                    <TransactionCategoryBadge
                      transaction={txn}
                      className="shrink-0 self-center"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{txn.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(txn.date).toLocaleDateString('he-IL')} •{' '}
                        {txn.account
                          ? getAccountDisplayName({
                              institutionName: txn.account.institutionName ?? '',
                              nickname: txn.account.nickname,
                            })
                          : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-start" dir="ltr">
                      <Amount value={amount} size="base" showSign={false} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>חשבונות פעילים</CardTitle>
            <CardDescription>{accounts?.count ?? 0} חשבונות</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {accounts?.accounts?.map((acc) => (
                <div key={acc.id} className="p-4">
                  <p className="font-medium">{getAccountDisplayName(acc)}</p>
                  {acc.nickname?.trim() ? (
                    <p className="text-xs text-muted-foreground">{acc.institutionName}</p>
                  ) : null}
                  {acc.description?.trim() ? (
                    <p className="text-xs text-muted-foreground">{acc.description}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                    {acc.accountNumber}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MonthlyComparisonChart data={historyData ?? []} isLoading={historyLoading} />
        <TrackedCategories
          categories={categoriesStatsRes?.categories ?? []}
          isLoading={trackedCategoriesLoading}
        />
      </div>
    </div>
  );
}
