import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi, categoriesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  PiggyBank,
  Pencil,
  Copy,
  Save,
  X,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';

function apiErrorMessage(err: unknown, fallback: string): string {
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const m = ax?.response?.data?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return fallback;
}

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [displayMonth, setDisplayMonth] = useState(now.getMonth() + 1);
  const [displayYear, setDisplayYear] = useState(now.getFullYear());
  const [isEditing, setIsEditing] = useState(false);
  const [editedBudgets, setEditedBudgets] = useState<Record<string, number>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isReordering, setIsReordering] = useState(false);

  const monthNames = [
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

  const { data: budget, isPending } = useQuery({
    queryKey: ['budget', displayMonth, displayYear, isInitialLoad],
    queryFn: async () => {
      if (isInitialLoad) {
        const res = await budgetsApi.get();
        return res.data;
      }
      const res = await budgetsApi.get(displayMonth, displayYear);
      return res.data;
    },
  });

  useEffect(() => {
    if (budget && isInitialLoad) {
      const b = budget as {
        displayMonth?: number;
        displayYear?: number;
      };
      if (b.displayMonth != null && b.displayYear != null) {
        setDisplayMonth(b.displayMonth);
        setDisplayYear(b.displayYear);
      }
      setIsInitialLoad(false);
    }
  }, [budget, isInitialLoad]);

  const { data: categories } = useQuery({
    queryKey: ['categories', 'expenses'],
    queryFn: async () => {
      const res = await categoriesApi.getExpenses();
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { categories: { categoryId: string; amount: number }[] }) => {
      const b = budget as { id?: string | null } | undefined;
      if (b?.id) {
        return budgetsApi.update(displayMonth, displayYear, data);
      }
      return budgetsApi.create({ month: displayMonth, year: displayYear, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      setIsEditing(false);
      setEditedBudgets({});
      toast.success('התקציב נשמר בהצלחה');
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'שגיאה בשמירת התקציב'));
    },
  });

  const copyMutation = useMutation({
    mutationFn: () => budgetsApi.copyFromPrevious(displayMonth, displayYear),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      toast.success('התקציב הועתק בהצלחה');
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'לא נמצא תקציב קודם להעתקה'));
    },
  });

  const moveCategoryMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      budgetsApi.moveCategoryUpDown(id, direction),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      const res = data?.data as { success?: boolean; message?: string } | undefined;
      if (res && res.success === false && res.message) {
        toast.info(res.message);
      }
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, 'שגיאה בשינוי הסדר'));
    },
  });

  const changeMonth = (delta: number) => {
    setIsInitialLoad(false);
    let newMonth = displayMonth + delta;
    let newYear = displayYear;

    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }

    setDisplayMonth(newMonth);
    setDisplayYear(newYear);
  };

  const startEditing = () => {
    const initial: Record<string, number> = {};
    const b = budget as { categories?: Array<{ categoryId: string; budgetAmount: number }> } | undefined;
    if (b?.categories) {
      b.categories.forEach((bc) => {
        initial[bc.categoryId] = bc.budgetAmount;
      });
    }
    setEditedBudgets(initial);
    setIsEditing(true);
  };

  const handleSave = () => {
    const budgetCategories = Object.entries(editedBudgets)
      .filter(([, amount]) => amount > 0)
      .map(([categoryId, amount]) => ({ categoryId, amount }));

    if (budgetCategories.length === 0) {
      toast.error('יש להגדיר לפחות קטגוריה אחת עם תקציב');
      return;
    }

    saveMutation.mutate({ categories: budgetCategories });
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedBudgets({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'exceeded':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  const isCurrentMonth = displayMonth === now.getMonth() + 1 && displayYear === now.getFullYear();
  const b = budget as
    | {
        id?: string | null;
        summary?: { totalSpent?: number; totalBudget?: number; totalRemaining?: number; overallPercentage?: number };
        usedFallback?: boolean;
        categories?: Array<{
          id: string;
          categoryId: string;
          category: { nameHe: string; icon: string; color: string };
          budgetAmount: number;
          spent: number;
          remaining: number;
          percentage: number;
          status: string;
        }>;
      }
    | undefined;

  const hasNoTransactions = b?.summary?.totalSpent === 0;
  const hasBudget = b?.id != null && b.id !== '';

  const totalEditedBudget = Object.values(editedBudgets).reduce((sum, v) => sum + (v || 0), 0);

  const fixedCategories = categories?.filter((c: { isFixed?: boolean; isIncome?: boolean }) => c.isFixed && !c.isIncome) || [];
  const trackedCategories =
    categories?.filter(
      (c: { isTracked?: boolean; isFixed?: boolean; isIncome?: boolean }) =>
        c.isTracked && !c.isFixed && !c.isIncome,
    ) || [];
  const otherCategories =
    categories?.filter(
      (c: { isTracked?: boolean; isFixed?: boolean; isIncome?: boolean }) =>
        !c.isTracked && !c.isFixed && !c.isIncome,
    ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">תקציבים</h1>
          <p className="text-muted-foreground">ניהול תקציב חודשי</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="min-w-32 text-center font-medium">
            {monthNames[displayMonth - 1]} {displayYear}
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {b?.usedFallback ? (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-400">
                מוצג חודש {monthNames[displayMonth - 1]} {displayYear}
              </p>
              <p className="text-sm text-muted-foreground">
                אין עסקאות בחודש הנוכחי. מוצג החודש האחרון עם נתונים.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasNoTransactions && hasBudget && !b?.usedFallback ? (
        <Card className="border-blue-500/50 bg-blue-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <Info className="h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <p className="font-medium text-blue-600 dark:text-blue-400">אין עסקאות בחודש זה</p>
              <p className="text-sm text-muted-foreground">
                {isCurrentMonth
                  ? 'העסקאות יופיעו לאחר סנכרון הבנק'
                  : 'נווט לחודש אחר לראות נתונים'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isPending ? (
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
            <Skeleton className="mt-4 h-2 w-full" />
          </CardContent>
        </Card>
      ) : b?.summary ? (
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">תקציב כולל</p>
                <p className="text-2xl font-bold">{formatCurrency(b.summary.totalBudget ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">הוצאות בפועל</p>
                <p className="text-2xl font-bold text-red-500">
                  {formatCurrency(b.summary.totalSpent ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">נותר</p>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    (b.summary.totalRemaining ?? 0) >= 0 ? 'text-green-500' : 'text-red-500',
                  )}
                >
                  {formatCurrency(b.summary.totalRemaining ?? 0)}
                </p>
              </div>
            </div>
            {(b.summary.totalBudget ?? 0) > 0 ? (
              <>
                <Progress
                  value={Math.min(b.summary.overallPercentage ?? 0, 100)}
                  className="mt-4"
                  indicatorClassName={cn(
                    (b.summary.overallPercentage ?? 0) >= 100
                      ? 'bg-red-500'
                      : (b.summary.overallPercentage ?? 0) >= 80
                        ? 'bg-yellow-500'
                        : 'bg-green-500',
                  )}
                />
                <p className="mt-1 text-end text-sm text-muted-foreground">
                  {b.summary.overallPercentage ?? 0}% מהתקציב
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isEditing ? (
          <>
            <Button type="button" onClick={startEditing}>
              <Pencil className="ms-2 h-4 w-4" />
              {hasBudget ? 'ערוך תקציב' : 'צור תקציב'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => copyMutation.mutate()}
              disabled={copyMutation.isPending}
            >
              {copyMutation.isPending ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="ms-2 h-4 w-4" />
              )}
              העתק מחודש קודם
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="ms-2 h-4 w-4" />
              )}
              שמור
            </Button>
            <Button type="button" variant="outline" onClick={cancelEditing}>
              <X className="ms-2 h-4 w-4" />
              ביטול
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>קטגוריות</CardTitle>
            <CardDescription>
              {isEditing ? 'הגדר תקציב לכל קטגוריה' : 'מעקב הוצאות לפי קטגוריה'}
            </CardDescription>
          </div>
          {!isEditing && hasBudget && b?.categories && b.categories.length > 0 ? (
            <Button
              type="button"
              variant={isReordering ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => setIsReordering((v) => !v)}
            >
              {isReordering ? 'סיום סידור' : 'שנה סדר'}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {isPending ? (
            <div className="divide-y">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : isEditing ? (
            <div className="divide-y">
              {fixedCategories.length > 0 ? (
                <div className="bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">הוצאות קבועות</h3>
                  <div className="space-y-2">
                    {fixedCategories.map(
                      (cat: { id: string; nameHe: string; icon: string; color: string }) => (
                        <EditCategoryRow
                          key={cat.id}
                          category={cat}
                          value={editedBudgets[cat.id] || 0}
                          onChange={(v) => setEditedBudgets({ ...editedBudgets, [cat.id]: v })}
                        />
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {trackedCategories.length > 0 ? (
                <div className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">הוצאות במעקב</h3>
                  <div className="space-y-2">
                    {trackedCategories.map(
                      (cat: { id: string; nameHe: string; icon: string; color: string }) => (
                        <EditCategoryRow
                          key={cat.id}
                          category={cat}
                          value={editedBudgets[cat.id] || 0}
                          onChange={(v) => setEditedBudgets({ ...editedBudgets, [cat.id]: v })}
                        />
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              {otherCategories.length > 0 ? (
                <div className="bg-muted/20 p-4">
                  <h3 className="mb-3 text-sm font-medium text-muted-foreground">הוצאות אחרות</h3>
                  <div className="space-y-2">
                    {otherCategories.map(
                      (cat: { id: string; nameHe: string; icon: string; color: string }) => (
                        <EditCategoryRow
                          key={cat.id}
                          category={cat}
                          value={editedBudgets[cat.id] || 0}
                          onChange={(v) => setEditedBudgets({ ...editedBudgets, [cat.id]: v })}
                        />
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <div className="bg-muted/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">סה&quot;כ תקציב:</span>
                  <span className="text-xl font-bold">{formatCurrency(totalEditedBudget)}</span>
                </div>
              </div>
            </div>
          ) : b?.categories && b.categories.length > 0 ? (
            <div className="divide-y">
              {b.categories.map((bc, index) => (
                <div key={bc.id} className="p-4">
                  <div className="mb-2 flex items-center gap-3">
                    {isReordering ? (
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={index === 0 || moveCategoryMutation.isPending}
                          onClick={() =>
                            moveCategoryMutation.mutate({ id: bc.id, direction: 'up' })
                          }
                          aria-label="הזז למעלה"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={
                            index === b.categories!.length - 1 ||
                            moveCategoryMutation.isPending
                          }
                          onClick={() =>
                            moveCategoryMutation.mutate({ id: bc.id, direction: 'down' })
                          }
                          aria-label="הזז למטה"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{ backgroundColor: `${bc.category.color || '#6b7280'}20` }}
                    >
                      {bc.category.icon || '❓'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{bc.category.nameHe}</p>
                        {bc.status === 'exceeded' ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                        ) : bc.status === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                        ) : bc.spent > 0 ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(bc.spent)} מתוך {formatCurrency(bc.budgetAmount)}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p
                        className={cn(
                          'font-semibold tabular-nums',
                          bc.remaining >= 0 ? 'text-green-500' : 'text-red-500',
                        )}
                      >
                        נותר {formatCurrency(bc.remaining)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {bc.percentage}%
                      </p>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(bc.percentage, 100)}
                    className="h-2"
                    indicatorClassName={getStatusColor(bc.status)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <PiggyBank className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">לא הוגדר תקציב לחודש זה</p>
              <Button type="button" variant="outline" className="mt-4" onClick={startEditing}>
                <Pencil className="ms-2 h-4 w-4" />
                צור תקציב
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditCategoryRow({
  category,
  value,
  onChange,
}: {
  category: { id: string; nameHe: string; icon: string; color: string };
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ backgroundColor: `${category.color}20` }}
      >
        {category.icon}
      </div>
      <span className="flex-1 truncate text-sm">{category.nameHe}</span>
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm text-muted-foreground">₪</span>
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          placeholder="0"
          className="h-8 w-24 text-left"
          dir="ltr"
          min={0}
        />
      </div>
    </div>
  );
}
