import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, categoriesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { getAccountDisplayName } from '@/lib/accountDisplay';
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
  Filter,
  ChevronRight,
  ChevronLeft,
  Receipt,
  Plus,
  X,
  Tag,
  Loader2,
  MessageSquare,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number | string;
  type?: string;
  status?: 'PENDING' | 'COMPLETED';
  category?: {
    id: string;
    nameHe: string;
    icon: string;
    color: string;
  };
  account?: {
    institutionName: string;
    nickname?: string | null;
    description?: string | null;
  };
  notes?: string;
  note?: string | null;
  isManual: boolean;
  isExcludedFromCashFlow?: boolean;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  originalAmount?: string | number | null;
  originalCurrency?: string | null;
}

function getTransactionTypeLabel(type: string | undefined): {
  label: string;
  icon: string;
  badgeClass: string;
} {
  const t = type || 'NORMAL';
  const types: Record<string, { label: string; icon: string; badgeClass: string }> = {
    NORMAL: {
      label: 'רגילה',
      icon: '💳',
      badgeClass: 'text-muted-foreground bg-muted',
    },
    INSTALLMENTS: {
      label: 'תשלומים',
      icon: '📅',
      badgeClass: 'text-blue-600 bg-blue-500/15 dark:text-blue-400',
    },
    CREDIT: {
      label: 'זיכוי',
      icon: '💰',
      badgeClass: 'text-green-600 bg-green-500/15 dark:text-green-400',
    },
    REFUND: {
      label: 'החזר',
      icon: '↩️',
      badgeClass: 'text-green-600 bg-green-500/15 dark:text-green-400',
    },
    CASH: {
      label: 'מזומן',
      icon: '💵',
      badgeClass: 'text-yellow-700 bg-yellow-500/15 dark:text-yellow-500',
    },
    TRANSFER: {
      label: 'העברה',
      icon: '🔄',
      badgeClass: 'text-purple-600 bg-purple-500/15 dark:text-purple-400',
    },
    FEE: {
      label: 'עמלה',
      icon: '🏦',
      badgeClass: 'text-red-600 bg-red-500/15 dark:text-red-400',
    },
    INTEREST: {
      label: 'ריבית',
      icon: '📈',
      badgeClass: 'text-orange-600 bg-orange-500/15 dark:text-orange-400',
    },
  };
  return types[t] || types.NORMAL;
}

function txnAmount(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
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

  const accountTypesFilter = useMemo(() => {
    const t: string[] = [];
    if (showBankTransactions) t.push('BANK');
    if (showCreditTransactions) t.push('CREDIT_CARD');
    return t;
  }, [showBankTransactions, showCreditTransactions]);

  const { data, isPending } = useQuery({
    queryKey: ['transactions', accountTypesFilter, page, search, selectedCategory],
    enabled: accountTypesFilter.length > 0,
    queryFn: () =>
      transactionsApi
        .getAll({
          page,
          limit: 50,
          search: search || undefined,
          categoryId: selectedCategory || undefined,
          accountTypes: accountTypesFilter,
        })
        .then((res) => res.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((res) => res.data),
  });

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
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="ms-2 h-4 w-4" />
              סינון
              {selectedCategory ? (
                <span className="me-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  1
                </span>
              ) : null}
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedCategory === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedCategory('');
                    setPage(1);
                  }}
                >
                  הכל
                </Button>
                {categories?.map(
                  (cat: { id: string; nameHe: string; icon?: string }) => (
                    <Button
                      key={cat.id}
                      type="button"
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setPage(1);
                      }}
                    >
                      {cat.icon} {cat.nameHe}
                    </Button>
                  ),
                )}
              </div>
            </div>
          )}
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
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">אין עסקאות</p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((txn) => {
                const amt = txnAmount(txn.amount);
                const typeInfo = getTransactionTypeLabel(txn.type);
                const instTotal = txn.installmentTotal != null ? Number(txn.installmentTotal) : 0;
                const hasInstallments = Number.isFinite(instTotal) && instTotal > 1;
                const orig = txn.originalAmount != null ? Number(txn.originalAmount) : null;
                const origCur = txn.originalCurrency || 'ILS';

                return (
                  <div
                    key={txn.id}
                    className={cn(
                      'flex items-center gap-4 p-4 transition-colors hover:bg-muted/50',
                      txn.status === 'PENDING' &&
                        'border-e-2 border-yellow-500 bg-yellow-500/5',
                      txn.isExcludedFromCashFlow && 'opacity-90 bg-muted/30',
                    )}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{
                        backgroundColor: txn.category?.color
                          ? `${txn.category.color}20`
                          : 'hsl(var(--muted))',
                      }}
                    >
                      {txn.category?.icon || '❓'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{txn.description}</p>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {(txn.type || 'NORMAL') !== 'NORMAL' ? (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                typeInfo.badgeClass,
                              )}
                            >
                              {typeInfo.icon} {typeInfo.label}
                            </span>
                          ) : null}
                          {hasInstallments ? (
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
                              תשלום {txn.installmentNumber ?? '?'}/{txn.installmentTotal}
                            </span>
                          ) : null}
                          {txn.status === 'PENDING' ? (
                            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-400">
                              בתהליך
                            </span>
                          ) : null}
                          {txn.isExcludedFromCashFlow ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              לא בתקציב
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDate(txn.date)}</span>
                        {txn.account ? (
                          <>
                            <span>•</span>
                            <span>{getAccountDisplayName(txn.account)}</span>
                          </>
                        ) : null}
                        {txn.note ? (
                          <>
                            <span>•</span>
                            <span
                              className="max-w-32 truncate text-blue-500"
                              title={txn.note ?? undefined}
                            >
                              {txn.note}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="פעולות"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingId(txn.id);
                            }}
                          >
                            שנה קטגוריה
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingNoteId(txn.id);
                              setNoteText(txn.note ?? '');
                            }}
                          >
                            הוסף הערה
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={excludeFromBudgetMutation.isPending}
                            onClick={() => {
                              excludeFromBudgetMutation.mutate({
                                id: txn.id,
                                exclude: !txn.isExcludedFromCashFlow,
                              });
                            }}
                          >
                            {txn.isExcludedFromCashFlow
                              ? '✓ כלול בתקציב'
                              : '✗ הסתר מתקציב'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          setEditingNoteId(txn.id);
                          setNoteText(txn.note ?? '');
                        }}
                        title="הערה"
                      >
                        <MessageSquare
                          className={cn(
                            'h-4 w-4',
                            txn.note ? 'text-blue-500' : 'text-muted-foreground',
                          )}
                        />
                      </Button>
                      {txn.note ? (
                        <span className="max-w-24 truncate text-xs text-muted-foreground">
                          {txn.note}
                        </span>
                      ) : null}
                    </div>

                    {editingId === txn.id ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          className="rounded border bg-background px-2 py-1 text-sm"
                          defaultValue={txn.category?.id ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            updateMutation.mutate({ id: txn.id, categoryId: v });
                          }}
                        >
                          <option value="">בחר קטגוריה</option>
                          {categories?.map(
                            (cat: { id: string; nameHe: string; icon?: string }) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.nameHe}
                              </option>
                            ),
                          )}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingId(txn.id)}
                        className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
                      >
                        {txn.category?.nameHe ?? 'לא מסווג'}
                      </button>
                    )}

                    <div className="shrink-0 text-end tabular-nums">
                      <p
                        className={cn(
                          'font-semibold',
                          amt > 0 ? 'text-green-500' : 'text-red-500',
                        )}
                      >
                        {formatCurrency(amt)}
                      </p>
                      {orig != null && !Number.isNaN(orig) && origCur !== 'ILS' ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {origCur} {orig.toFixed(2)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
