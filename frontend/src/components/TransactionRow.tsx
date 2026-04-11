import { useState } from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  MoreVertical,
  MessageSquare,
  Tag,
  CreditCard,
  Building2,
  Clock,
  AlertCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Amount } from '@/components/Amount';
import { getAccountDisplayName } from '@/lib/accountDisplay';
import { TransactionCategoryBadge } from '@/components/TransactionCategoryBadge';

export interface TransactionRowTransaction {
  id: string;
  description: string;
  amount: number | string;
  date: string;
  effectiveDate?: string | null;
  note?: string | null;
  status?: 'PENDING' | 'COMPLETED';
  type?: string;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  isExcludedFromCashFlow?: boolean;
  categoryId?: string | null;
  category?: {
    id?: string | null;
    name?: string;
    nameHe?: string;
    icon?: string;
    color?: string;
  } | null;
  account?: {
    nickname?: string | null;
    institutionName: string;
    description?: string | null;
    accountNumber?: string;
  };
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

function getCategoryColor(category?: { color?: string | null } | null): string {
  const c = category?.color?.trim();
  if (c && /^#[0-9A-Fa-f]{3,8}$/.test(c)) return c;
  return 'hsl(var(--muted))';
}

function isCreditInstitution(name: string | undefined): boolean {
  if (!name) return false;
  return (
    name.includes('כאל') ||
    name.includes('ויזה') ||
    name.includes('אשראי') ||
    name.includes('CAL') ||
    name.includes('מקס')
  );
}

export interface TransactionRowCategoryOption {
  id: string;
  nameHe: string;
  icon?: string;
}

interface TransactionRowProps {
  transaction: TransactionRowTransaction;
  onChangeCategory: (transactionId: string) => void;
  onAddNote: (transactionId: string) => void;
  onToggleExclude: (transactionId: string) => void;
  isSelected?: boolean;
  isEditingCategory?: boolean;
  categoryOptions?: TransactionRowCategoryOption[];
  onPickCategory?: (categoryId: string) => void;
  onCancelEditCategory?: () => void;
  excludeActionDisabled?: boolean;
}

export function TransactionRow({
  transaction,
  onChangeCategory,
  onAddNote,
  onToggleExclude,
  isSelected,
  isEditingCategory,
  categoryOptions,
  onPickCategory,
  onCancelEditCategory,
  excludeActionDisabled,
}: TransactionRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const amount = txnAmount(transaction.amount);
  const isExcluded = transaction.isExcludedFromCashFlow;
  const isPending = transaction.status === 'PENDING';
  const instTotal =
    transaction.installmentTotal != null ? Number(transaction.installmentTotal) : 0;
  const hasInstallments =
    Number.isFinite(instTotal) &&
    instTotal > 1 &&
    transaction.installmentNumber != null;

  const dateSrc = transaction.effectiveDate || transaction.date;
  let formattedDate: string;
  try {
    formattedDate = format(new Date(dateSrc), 'd MMM yyyy', { locale: he });
  } catch {
    formattedDate = transaction.date;
  }

  const accountName = transaction.account
    ? getAccountDisplayName(transaction.account)
    : '';

  const typeInfo = getTransactionTypeLabel(transaction.type);
  const showTypeBadge = (transaction.type || 'NORMAL') !== 'NORMAL';
  const categoryTint = getCategoryColor(transaction.category);

  const orig =
    transaction.originalAmount != null ? Number(transaction.originalAmount) : null;
  const origCur = transaction.originalCurrency || 'ILS';

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 border-b border-border p-4 transition-colors sm:items-center sm:gap-4',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5',
        isExcluded && 'opacity-60',
        isPending && 'border-e-2 border-pending bg-pending/10',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg sm:mt-0"
        style={{
          backgroundColor:
            categoryTint.startsWith('#') ? `${categoryTint}33` : 'hsl(var(--muted) / 0.2)',
          color: categoryTint,
        }}
      >
        {transaction.category?.icon || '❓'}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="max-w-md truncate font-medium">{transaction.description}</p>
          {showTypeBadge ? (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-xs',
                typeInfo.badgeClass,
              )}
            >
              {typeInfo.icon} {typeInfo.label}
            </span>
          ) : null}
          {isPending ? (
            <span className="badge-pending inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              בתהליך
            </span>
          ) : null}
          {hasInstallments ? (
            <Badge variant="outline" className="text-xs">
              תשלום {transaction.installmentNumber}/{transaction.installmentTotal}
            </Badge>
          ) : null}
          {isExcluded ? (
            <Badge
              variant="outline"
              className="border-orange-500 text-xs text-orange-600 dark:text-orange-500"
            >
              לא בתקציב
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{formattedDate}</span>
          {transaction.account ? (
            <>
              <span>•</span>
              <span className="flex items-center gap-1">
                {isCreditInstitution(transaction.account.institutionName) ? (
                  <CreditCard className="h-3 w-3 shrink-0" />
                ) : (
                  <Building2 className="h-3 w-3 shrink-0" />
                )}
                {accountName}
              </span>
            </>
          ) : null}
          {transaction.account?.accountNumber ? (
            <>
              <span>•</span>
              <span className="font-mono text-xs">
                {String(transaction.account.accountNumber).slice(-4)}
              </span>
            </>
          ) : null}
        </div>

        {transaction.note ? (
          <div className="flex items-start gap-1 text-sm">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            <p
              className="max-w-lg truncate italic text-muted-foreground"
              title={transaction.note}
            >
              {transaction.note}
            </p>
          </div>
        ) : null}

        <div className="pt-1 sm:hidden">
          {isEditingCategory && categoryOptions && onPickCategory && onCancelEditCategory ? (
            <div className="flex flex-wrap items-center gap-1">
              <select
                className="max-w-full rounded border border-border bg-background px-2 py-1 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) onPickCategory(v);
                }}
              >
                <option value="">בחר קטגוריה</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.nameHe}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onCancelEditCategory}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChangeCategory(transaction.id)}
              className="w-full text-start transition-opacity hover:opacity-80"
            >
              <TransactionCategoryBadge transaction={transaction} />
            </button>
          )}
        </div>
      </div>

      <div className="w-24 shrink-0 text-start sm:w-28" dir="ltr">
        <Amount value={amount} size="lg" showSign={false} />
        {orig != null && !Number.isNaN(orig) && origCur !== 'ILS' ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {origCur} {orig.toFixed(2)}
          </p>
        ) : null}
      </div>

      <div className="hidden w-36 shrink-0 sm:block">
        {isEditingCategory && categoryOptions && onPickCategory && onCancelEditCategory ? (
          <div className="flex items-center gap-1">
            <select
              className="max-w-full rounded border border-border bg-background px-2 py-1 text-sm"
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) onPickCategory(v);
              }}
            >
              <option value="">בחר קטגוריה</option>
              {categoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.nameHe}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onCancelEditCategory}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChangeCategory(transaction.id)}
            className="w-full text-end transition-opacity hover:opacity-80"
          >
            <TransactionCategoryBadge transaction={transaction} />
          </button>
        )}
      </div>

      {/* פעולות */}
      <div
        className={cn(
          'w-10 shrink-0 transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onChangeCategory(transaction.id)}>
              <Tag className="ms-2 h-4 w-4" />
              שנה קטגוריה
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddNote(transaction.id)}>
              <MessageSquare className="ms-2 h-4 w-4" />
              {transaction.note ? 'ערוך הערה' : 'הוסף הערה'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={excludeActionDisabled}
              onClick={() => onToggleExclude(transaction.id)}
            >
              <AlertCircle className="ms-2 h-4 w-4" />
              {isExcluded ? 'כלול בתקציב' : 'הוצא מתקציב'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
