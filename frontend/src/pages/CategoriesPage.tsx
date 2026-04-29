import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, dashboardApi, settingsApi } from '@/services/api';
import { getBudgetCycleLabelForIsraelDate } from '@/lib/israel-calendar';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';

interface Category {
  id: string;
  name: string;
  nameHe: string;
  icon: string;
  color: string;
  isSystem: boolean;
  isIncome: boolean;
  isFixed: boolean;
  isTracked: boolean;
  keywords: string[];
  transactionCount?: number;
  totalAmount?: number;
  monthlyTarget?: number | null;
  spent?: number;
  remaining?: number | null;
  percentUsed?: number | null;
  isOverBudget?: boolean;
  income?: number;
}

interface CategoryBreakdownRow {
  categoryId: string | null;
  nameHe: string;
  icon: string;
  total: number;
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

const ICONS = [
  '🛒',
  '🍽️',
  '🚗',
  '⛽',
  '🏠',
  '💡',
  '📱',
  '🎬',
  '👕',
  '💊',
  '🏥',
  '✈️',
  '🎁',
  '💰',
  '📈',
  '🏦',
  '💳',
  '🛍️',
  '🎓',
  '👶',
  '🐕',
  '🏃',
  '🔨',
  '💻',
  '❓',
];

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

function normalizeKeywords(raw: unknown): string[] {
  if (Array.isArray(raw) && raw.every((k) => typeof k === 'string')) {
    return raw;
  }
  return [];
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

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const cycleInitial = getBudgetCycleLabelForIsraelDate(new Date(), 1);
  const [trackMonth, setTrackMonth] = useState(cycleInitial.month);
  const [trackYear, setTrackYear] = useState(cycleInitial.year);
  const appliedBudgetCycle = useRef(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const [formData, setFormData] = useState<{
    name: string;
    nameHe: string;
    icon: string;
    color: string;
    isIncome: boolean;
    isFixed: boolean;
    isTracked: boolean;
    keywords: string;
    monthlyTarget: number | '';
  }>({
    name: '',
    nameHe: '',
    icon: '❓',
    color: '#3b82f6',
    isIncome: false,
    isFixed: false,
    isTracked: true,
    keywords: '',
    monthlyTarget: '',
  });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const { data: userSettings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      settingsApi.get().then((res) => res.data as { budgetCycleStartDay?: number }),
  });

  useEffect(() => {
    if (appliedBudgetCycle.current || userSettings === undefined) return;
    appliedBudgetCycle.current = true;
    const csd = Number(userSettings.budgetCycleStartDay ?? 1);
    const { month: m, year: y } = getBudgetCycleLabelForIsraelDate(new Date(), csd);
    setTrackMonth(m);
    setTrackYear(y);
  }, [userSettings]);

  useEffect(() => {
    if (editingCategory || !showAddModal) {
      setDuplicateWarning(null);
      return;
    }
    const name = formData.name.trim();
    const nameHe = formData.nameHe.trim();
    if (name.length < 2 && nameHe.length < 2) {
      setDuplicateWarning(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await categoriesApi.checkDuplicate({
            ...(name.length >= 2 ? { name } : {}),
            ...(nameHe.length >= 2 ? { nameHe } : {}),
          });
          const d = res.data as {
            hasDuplicate: boolean;
            duplicates: Array<{ nameHe: string; isSystem: boolean }>;
          };
          if (d.hasDuplicate && d.duplicates[0]) {
            const ex = d.duplicates[0];
            setDuplicateWarning(
              `קטגוריה "${ex.nameHe}" כבר קיימת${ex.isSystem ? ' (קטגוריית מערכת)' : ''}`,
            );
          } else {
            setDuplicateWarning(null);
          }
        } catch {
          /* ignore */
        }
      })();
    }, 450);
    return () => clearTimeout(t);
  }, [formData.name, formData.nameHe, showAddModal, editingCategory]);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', 'with-stats', trackMonth, trackYear],
    queryFn: async () => {
      const res = await categoriesApi.getWithStats(trackMonth, trackYear);
      const payload = res.data as {
        categories: (Category & { keywords?: unknown })[];
      };
      return payload.categories.map((c) => ({
        ...c,
        keywords: normalizeKeywords(c.keywords),
      }));
    },
  });

  const { data: categorySpending } = useQuery({
    queryKey: ['dashboard', 'categories', trackMonth, trackYear],
    queryFn: () =>
      dashboardApi
        .getCategories(trackMonth, trackYear)
        .then((res) => res.data as CategoryBreakdownRow[]),
  });

  const changeTrackMonth = (delta: number) => {
    let m = trackMonth + delta;
    let y = trackYear;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setTrackMonth(m);
    setTrackYear(y);
  };

  const trackedSpendingRows =
    categorySpending
      ?.filter((row) => {
        const c = categories?.find((x) => x.id === row.categoryId);
        return Boolean(c?.isTracked && !c.isIncome && row.total > 0);
      })
      .sort((a, b) => b.total - a.total) ?? [];

  const invalidateCategoryQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => categoriesApi.create(data),
    onSuccess: () => {
      invalidateCategoryQueries();
      resetForm();
      setShowAddModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidateCategoryQueries();
      resetForm();
      setEditingCategory(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      invalidateCategoryQueries();
    },
  });

  const resetForm = () => {
    setDuplicateWarning(null);
    setFormData({
      name: '',
      nameHe: '',
      icon: '❓',
      color: '#3b82f6',
      isIncome: false,
      isFixed: false,
      isTracked: true,
      keywords: '',
      monthlyTarget: '',
    });
  };

  const openEditModal = (cat: Category) => {
    setDuplicateWarning(null);
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      nameHe: cat.nameHe,
      icon: cat.icon || '❓',
      color: cat.color || '#3b82f6',
      isIncome: cat.isIncome,
      isFixed: cat.isFixed,
      isTracked: cat.isTracked,
      keywords: cat.keywords?.join(', ') || '',
      monthlyTarget:
        cat.monthlyTarget != null && !Number.isNaN(Number(cat.monthlyTarget))
          ? Number(cat.monthlyTarget)
          : '',
    });
  };

  const handleSubmit = () => {
    const monthlyTargetPayload =
      formData.monthlyTarget === ''
        ? editingCategory
          ? null
          : undefined
        : Number(formData.monthlyTarget);

    const data: Record<string, unknown> = {
      name: formData.name,
      nameHe: formData.nameHe,
      icon: formData.icon,
      color: formData.color,
      isIncome: formData.isIncome,
      isFixed: formData.isFixed,
      isTracked: formData.isTracked,
      keywords: formData.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };

    if (monthlyTargetPayload !== undefined) {
      data.monthlyTarget = monthlyTargetPayload;
    }

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredCategories = categories?.filter((cat: Category) => {
    if (filter === 'income') return cat.isIncome;
    if (filter === 'expense') return !cat.isIncome;
    return true;
  });

  const incomeCategories = categories?.filter((c: Category) => c.isIncome) || [];
  const expenseCategories = categories?.filter((c: Category) => !c.isIncome) || [];

  const cycleStartDayUi = Number(userSettings?.budgetCycleStartDay ?? 1);
  const statsPeriodLabel = formatBudgetCycleRange(trackMonth, trackYear, cycleStartDayUi);
  const nonCalendarCycle = cycleStartDayUi > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="קטגוריות"
        subtitle={`${incomeCategories.length} הכנסות • ${expenseCategories.length} הוצאות`}
        actions={
          <Button type="button" onClick={() => setShowAddModal(true)}>
            <Plus className="ms-2 h-4 w-4" />
            קטגוריה חדשה
          </Button>
        }
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          הכל
        </Button>
        <Button
          type="button"
          variant={filter === 'income' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('income')}
        >
          <TrendingUp className="ms-1 h-4 w-4 text-green-500" />
          הכנסות
        </Button>
        <Button
          type="button"
          variant={filter === 'expense' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('expense')}
        >
          <TrendingDown className="ms-1 h-4 w-4 text-red-500" />
          הוצאות
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">
            קטגוריות במעקב — הוצאות
            {nonCalendarCycle ? ' במחזור ' : ' בחודש '}
            {statsPeriodLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => changeTrackMonth(-1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="min-w-[6.5rem] max-w-[14rem] text-center text-sm leading-snug">
              {statsPeriodLabel}
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => changeTrackMonth(1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {trackedSpendingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              אין הוצאות {nonCalendarCycle ? 'במחזור זה' : 'בחודש זה'} בקטגוריות המסומנות
              &quot;במעקב&quot;.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {trackedSpendingRows.map((cat) => (
                <div
                  key={cat.categoryId ?? cat.nameHe}
                  className="flex items-center justify-between gap-2 p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.nameHe}</span>
                  </div>
                  <span className="shrink-0 font-medium text-red-500 tabular-nums">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredCategories?.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">אין קטגוריות</p>
            </CardContent>
          </Card>
        ) : (
          filteredCategories?.map((cat: Category) => (
            <Card key={cat.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${cat.color}20` }}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{cat.nameHe}</p>
                      {cat.isSystem ? (
                        <span
                          className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          title="קטגוריית מערכת"
                        >
                          מערכת
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {cat.isIncome ? (
                        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">
                          הכנסה
                        </span>
                      ) : null}
                      {cat.isFixed ? (
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-500">
                          קבועה
                        </span>
                      ) : null}
                      {cat.isTracked && !cat.isFixed ? (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-500">
                          במעקב
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cat.transactionCount ?? 0} עסקאות ב־{statsPeriodLabel}
                    </p>
                  </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p
                      className={cn(
                        'font-semibold tabular-nums',
                        cat.isIncome ? 'text-green-500' : 'text-red-500',
                      )}
                    >
                      {formatCurrency(cat.totalAmount ?? 0)}
                    </p>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditModal(cat)}
                      aria-label="ערוך"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!cat.isSystem ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`למחוק את הקטגוריה "${cat.nameHe}"?`)) {
                            deleteMutation.mutate(cat.id);
                          }
                        }}
                        aria-label="מחק"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  </div>
                </div>
                {cat.keywords && cat.keywords.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {cat.keywords.slice(0, 3).map((kw, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {kw}
                      </span>
                    ))}
                    {cat.keywords.length > 3 ? (
                      <span className="text-xs text-muted-foreground">
                        +{cat.keywords.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showAddModal || editingCategory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Card className="m-4 max-h-[90vh] w-full max-w-md overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingCategory ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</CardTitle>
              <CardDescription>
                {editingCategory
                  ? 'ערוך את פרטי הקטגוריה'
                  : 'צור קטגוריה חדשה לסיווג עסקאות'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {duplicateWarning && !editingCategory ? (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">{duplicateWarning}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">שם (אנגלית)</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="groceries"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">שם (עברית)</label>
                  <Input
                    value={formData.nameHe}
                    onChange={(e) => setFormData({ ...formData, nameHe: e.target.value })}
                    placeholder="מכולת"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">אייקון</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors',
                        formData.icon === icon
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80',
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">צבע</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={cn(
                        'h-8 w-8 rounded-full transition-transform',
                        formData.color === color &&
                          'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`צבע ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">סוג</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={formData.isIncome ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, isIncome: !formData.isIncome })}
                  >
                    <TrendingUp className="ms-1 h-4 w-4" />
                    הכנסה
                  </Button>
                  <Button
                    type="button"
                    variant={formData.isFixed ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, isFixed: !formData.isFixed })}
                  >
                    הוצאה קבועה
                  </Button>
                  <Button
                    type="button"
                    variant={formData.isTracked ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormData({ ...formData, isTracked: !formData.isTracked })}
                  >
                    במעקב תקציב
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>יעד חודשי (אופציונלי)</Label>
                <p className="text-xs text-muted-foreground">
                  סכום מקסימלי להוצאה בקטגוריה זו במחזור הנבחר בדף קטגוריות
                </p>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.monthlyTarget === '' ? '' : formData.monthlyTarget}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData({
                        ...formData,
                        monthlyTarget: v === '' ? '' : Number(v),
                      });
                    }}
                    placeholder="ללא הגבלה"
                    className="ps-8"
                    dir="ltr"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ₪
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">מילות מפתח (לסיווג אוטומטי)</label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="רמי לוי, שופרסל, מגה"
                />
                <p className="text-xs text-muted-foreground">
                  הפרד עם פסיקים. עסקאות עם מילים אלו יסווגו אוטומטית
                </p>
              </div>
            </CardContent>

            <div className="flex gap-2 p-6 pt-0">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCategory(null);
                  resetForm();
                }}
              >
                ביטול
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.name ||
                  !formData.nameHe
                }
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                ) : null}
                {editingCategory ? 'שמור' : 'צור'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
