import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, transactionsApi, settingsApi } from '@/services/api';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatShortDate, cn } from '@/lib/utils';
import { getAccountDisplayName } from '@/lib/accountDisplay';
import { getBudgetCycleLabelForIsraelDate } from '@/lib/israel-calendar';
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
  account?: {
    institutionName?: string;
    nickname?: string | null;
    description?: string | null;
  };
  category?: { nameHe?: string; icon?: string; color?: string };
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
                  <p className="text-2xl font-bold text-green-500">
                    {formatCurrency(summary?.income?.total ?? 0)}
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-500" />
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
                  <p className="text-2xl font-bold text-red-500">
                    {formatCurrency(summary?.expenses?.total ?? 0)}
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-500" />
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
                  <p
                    className={cn(
                      'text-2xl font-bold',
                      (summary?.remaining ?? 0) >= 0 ? 'text-green-500' : 'text-red-500',
                    )}
                  >
                    {formatCurrency(summary?.remaining ?? 0)}
                  </p>
                )}
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <Wallet className="h-6 w-6 text-blue-500" />
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span aria-hidden>📅</span>
              תשלומים פעילים
            </CardTitle>
            <CardDescription>
              {installments.activeCount} מסלולי תשלומים מזוהים
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">חיוב חודשי (סכום תשלומים):</span>
                <span className="font-medium text-red-500 tabular-nums">
                  {formatCurrency(installments.totalMonthly)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">הערכת נותר לתשלום:</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(installments.totalRemaining)}
                </span>
              </div>
            </div>
            <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
              {installments.details.slice(0, 5).map((item, i) => (
                <div
                  key={`${item.description}-${i}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="max-w-[40%] truncate" title={item.description}>
                    {item.description}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {item.currentPayment ?? '?'}/{item.totalPayments ?? '?'}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(item.monthlyAmount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
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
                        fill={entry.total > 0 ? '#ef4444' : '#d1d5db'}
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
              <CardTitle>הוצאות מובילות לפי קטגוריה</CardTitle>
              <CardDescription>{periodTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {topCategories.map((cat) => (
                  <div
                    key={cat.categoryId ?? cat.nameHe}
                    className="flex items-center justify-between gap-4 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-lg">{cat.icon}</span>
                      <span className="truncate font-medium">{cat.nameHe}</span>
                    </div>
                    <span className="shrink-0 font-semibold text-red-500 tabular-nums">
                      {formatCurrency(cat.total)}
                    </span>
                  </div>
                ))}
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
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{
                        backgroundColor: `${txn.category?.color || '#6b7280'}20`,
                      }}
                    >
                      {txn.category?.icon || '❓'}
                    </div>
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
                    <p
                      className={cn(
                        'shrink-0 font-semibold tabular-nums',
                        amount > 0 ? 'text-green-500' : 'text-red-500',
                      )}
                    >
                      {formatCurrency(amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>חשבונות פעילים</CardTitle>
            <CardDescription>
              {accounts?.count ?? 0} חשבונות • יתרה כוללת{' '}
              {formatCurrency(accounts?.totalBalance ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {accounts?.accounts?.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between p-4">
                  <div>
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
                  <p className="font-semibold tabular-nums">
                    {formatCurrency(num(acc.balance))}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
