import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, categoriesApi } from '@/services/api';
import { AICategorizeButton } from '@/components/AICategorizeButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Receipt,
  Plus,
  Tag,
  Loader2,
  Download,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number | string;
  type?: string;
  status?: 'PENDING' | 'COMPLETED';
  categoryId?: string | null;
  category?: {
    id?: string | null;
    name?: string;
    nameHe: string;
    icon: string;
    color: string;
  };
  isUncategorized?: boolean;
  account?: {
    institutionName: string;
    nickname?: string | null;
    description?: string | null;
    accountNumber?: string;
  };
  notes?: string;
  note?: string | null;
  isManual: boolean;
  isExcludedFromCashFlow?: boolean;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  originalAmount?: string | number | null;
  originalCurrency?: string | null;
  exchangeRate?: string | number | null;
  isAbroad?: boolean;
  foreignCurrencyDisplay?: string | null;
  effectiveDate?: string | null;
}

/** System uncategorized category — shown only by the dedicated filter button */
const SYSTEM_UNCATEGORIZED_CATEGORY_ID =
  '00000000-0000-0000-0000-000000000001';

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [showBankTransactions, setShowBankTransactions] = useState(true);
  const [showCreditTransactions, setShowCreditTransactions] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [manualAmount, setManualAmount] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategoryId, setManualCategoryId] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [abroadScope, setAbroadScope] = useState<'all' | 'local' | 'abroad'>(
    'all',
  );

  const accountTypesFilter = useMemo(() => {
    const t: string[] = [];
    if (showBankTransactions) t.push('BANK');
    if (showCreditTransactions) t.push('CREDIT_CARD');
    return t;
  }, [showBankTransactions, showCreditTransactions]);

  const { data, isPending } = useQuery({
    queryKey: [
      'transactions',
      accountTypesFilter,
      page,
      search,
      selectedCategory,
      abroadScope,
    ],
    enabled: accountTypesFilter.length > 0,
    queryFn: () =>
      transactionsApi
        .getAll({
          page,
          limit: 50,
          search: search || undefined,
          categoryId:
            selectedCategory === 'uncategorized'
              ? 'uncategorized'
              : selectedCategory || undefined,
          accountTypes: accountTypesFilter,
          ...(abroadScope === 'abroad'
            ? { isAbroad: true }
            : abroadScope === 'local'
              ? { isAbroad: false }
              : {}),
        })
        .then((res) => res.data),
  });

  /** Combined NULL + uncategorized (matches backend `categoryId=uncategorized`) */
  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: ['transactions', 'uncategorized-total', accountTypesFilter],
    enabled: accountTypesFilter.length > 0,
    queryFn: () =>
      transactionsApi
        .getAll({
          page: 1,
          limit: 1,
          categoryId: 'uncategorized',
          accountTypes: accountTypesFilter,
        })
        .then((res) => res.data.pagination.total),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((res) => res.data),
  });

  const categoryFilters = useMemo(() => {
    if (!categories?.length) return [];
    return categories.filter(
      (cat: { id: string; name?: string }) =>
        cat.name !== 'uncategorized' &&
        cat.id !== SYSTEM_UNCATEGORIZED_CATEGORY_ID,
    );
  }, [categories]);

  const updateMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      transactionsApi.update(id, { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      date: string;
      amount: number;
      description: string;
      categoryId?: string;
    }) => transactionsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowManual(false);
      setManualAmount('');
      setManualDescription('');
      setManualCategoryId('');
    },
  });

  const recategorizeMutation = useMutation({
    mutationFn: () => transactionsApi.recategorizeAll(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alert((res.data as { message?: string }).message ?? 'בוצע');
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string | null }) =>
      transactionsApi.updateNote(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingNoteId(null);
      setNoteText('');
    },
  });

  const excludeFromBudgetMutation = useMutation({
    mutationFn: ({ id, exclude }: { id: string; exclude: boolean }) =>
      transactionsApi.setExcludeFromCashFlow(id, exclude),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const transactions: Transaction[] =
    accountTypesFilter.length === 0 ? [] : (data?.data ?? []);
  const pagination = data?.pagination ?? {
    page: 1,
    totalPages: 1,
    total: 0,
  };

  const submitManual = () => {
    const amount = Number(manualAmount);
    if (!manualDescription.trim() || Number.isNaN(amount)) return;
    createMutation.mutate({
      date: new Date(manualDate).toISOString(),
      amount,
      description: manualDescription.trim(),
      ...(manualCategoryId ? { categoryId: manualCategoryId } : {}),
    });
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await transactionsApi.exportExcel();
      const blob = res.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transactions.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('הקובץ הורד בהצלחה');
    } catch {
      toast.error('שגיאה בייצוא');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">עסקאות</h1>
          <p className="text-muted-foreground">
            {accountTypesFilter.length === 0
              ? 'בחר סוג חשבון'
              : `${pagination.total} עסקאות`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-bank"
                  checked={showBankTransactions}
                  onCheckedChange={(checked) => {
                    setShowBankTransactions(checked === true);
                    setPage(1);
                  }}
                />
                <Label htmlFor="show-bank" className="cursor-pointer text-sm font-normal">
                  🏦 בנק
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-credit"
                  checked={showCreditTransactions}
                  onCheckedChange={(checked) => {
                    setShowCreditTransactions(checked === true);
                    setPage(1);
                  }}
                />
                <Label htmlFor="show-credit" className="cursor-pointer text-sm font-normal">
                  💳 אשראי
                </Label>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AICategorizeButton mode="uncategorized" />
          <AICategorizeButton mode="improve" />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="ms-2 h-4 w-4" />
            )}
            ייצוא לאקסל
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => recategorizeMutation.mutate()}
            disabled={recategorizeMutation.isPending}
          >
            {recategorizeMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <Tag className="ms-2 h-4 w-4" />
            )}
            סווג מחדש
          </Button>
          <Button type="button" onClick={() => setShowManual(true)}>
            <Plus className="ms-2 h-4 w-4" />
            עסקה ידנית
          </Button>
        </div>
      </div>

      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="m-4 w-full max-w-md">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">עסקה ידנית</h2>
              <div className="space-y-2">
                <label className="text-sm font-medium">תאריך</label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  dir="ltr"
                  className="text-start"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">סכום (שלילי = הוצאה)</label>
                <Input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="-100"
                  dir="ltr"
                  className="text-start"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">תיאור</label>
                <Input
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="תיאור העסקה"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">קטגוריה (אופציונלי)</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualCategoryId}
                  onChange={(e) => setManualCategoryId(e.target.value)}
                >
                  <option value="">ללא</option>
                  {categories?.map((cat: { id: string; nameHe: string; icon?: string }) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ?? ''} {cat.nameHe}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowManual(false)}
                >
                  ביטול
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    createMutation.isPending ||
                    !manualDescription.trim() ||
                    manualAmount === ''
                  }
                  onClick={submitManual}
                >
                  שמור
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="relative max-w-md flex-1">
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש עסקאות..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pe-10"
              />
            </div>
            <div className="flex min-w-[11rem] flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">מיקום עסקה</span>
              <Select
                value={abroadScope}
                onValueChange={(v) => {
                  setAbroadScope(v as 'all' | 'local' | 'abroad');
                  setPage(1);
                }}
              >
                <SelectTrigger dir="rtl" className="w-full">
                  <SelectValue placeholder="הכל" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="local">ארץ 🇮🇱</SelectItem>
                  <SelectItem value="abroad">חו״ל 🌍</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto pb-2">
            <Button
              type="button"
              variant={selectedCategory === '' ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => {
                setSelectedCategory('');
                setPage(1);
              }}
            >
              הכל
            </Button>
            <Button
              type="button"
              variant={
                selectedCategory === 'uncategorized' ? 'default' : 'outline'
              }
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => {
                setSelectedCategory((prev) =>
                  prev === 'uncategorized' ? '' : 'uncategorized',
                );
                setPage(1);
              }}
            >
              <span aria-hidden>❓</span>
              לא מסווג
              {uncategorizedCount > 0 ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {uncategorizedCount}
                </Badge>
              ) : null}
            </Button>
            <div className="mx-1 h-6 w-px shrink-0 bg-border" />
            {categoryFilters.map(
              (cat: { id: string; nameHe: string; icon?: string; name?: string }) => (
                <Button
                  key={cat.id}
                  type="button"
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setPage(1);
                  }}
                >
                  {cat.icon ? <span>{cat.icon}</span> : null}
                  {cat.nameHe || cat.name}
                </Button>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {accountTypesFilter.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                בחר לפחות סוג חשבון אחד להצגת עסקאות
              </p>
            </div>
          ) : isPending ? (
            <div className="divide-y">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="hidden items-center gap-4 border-b bg-muted/30 p-4 text-sm font-medium text-muted-foreground md:flex">
                <div className="w-24 shrink-0">סכום</div>
                <div className="flex-1">פרטים</div>
                <div className="w-36 shrink-0">קטגוריה</div>
                <div className="w-10 shrink-0" />
              </div>
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Receipt className="mx-auto mb-2 h-10 w-10 opacity-50" />
                  <p>אין עסקאות להצגה</p>
                </div>
              ) : (
                transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    transaction={txn}
                    isEditingCategory={editingId === txn.id}
                    categoryOptions={
                      categories?.map(
                        (c: { id: string; nameHe: string; icon?: string }) => ({
                          id: c.id,
                          nameHe: c.nameHe,
                          icon: c.icon,
                        }),
                      ) ?? []
                    }
                    onPickCategory={(categoryId) =>
                      updateMutation.mutate({ id: txn.id, categoryId })
                    }
                    onCancelEditCategory={() => setEditingId(null)}
                    onChangeCategory={(id) => setEditingId(id)}
                    onAddNote={(id) => {
                      setEditingNoteId(id);
                      const t = transactions.find((x) => x.id === id);
                      setNoteText(t?.note ?? '');
                    }}
                    onToggleExclude={(id) => {
                      const t = transactions.find((x) => x.id === id);
                      if (t) {
                        excludeFromBudgetMutation.mutate({
                          id,
                          exclude: !t.isExcludedFromCashFlow,
                        });
                      }
                    }}
                    excludeActionDisabled={excludeFromBudgetMutation.isPending}
                  />
                ))
              )}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronRight className="ms-1 h-4 w-4" />
                הקודם
              </Button>
              <span className="text-sm text-muted-foreground">
                עמוד {page} מתוך {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                הבא
                <ChevronLeft className="me-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!editingNoteId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingNoteId(null);
            setNoteText('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הערה לעסקה</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="הוסף הערה..."
            className="min-h-24"
          />
          <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
            {noteText ? (
              <Button
                type="button"
                variant="outline"
                disabled={updateNoteMutation.isPending}
                onClick={() => {
                  if (editingNoteId) {
                    updateNoteMutation.mutate({ id: editingNoteId, note: null });
                  }
                }}
              >
                מחק הערה
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              disabled={updateNoteMutation.isPending || !editingNoteId}
              onClick={() => {
                if (!editingNoteId) return;
                updateNoteMutation.mutate({
                  id: editingNoteId,
                  note: noteText.trim() || null,
                });
              }}
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
