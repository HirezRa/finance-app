import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
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
import { ForeignCurrencyBadge } from '@/components/ForeignCurrencyBadge';
import {
  TRANSACTION_LIST_GRID_CLASS,
  TXN_COL_ACTIONS,
  TXN_COL_AMOUNT,
  TXN_COL_AVATAR,
  TXN_COL_CATEGORY,
  TXN_COL_CONTENT,
} from '@/components/transaction-list-layout';

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
  exchangeRate?: string | number | null;
  isAbroad?: boolean;
  foreignCurrencyDisplay?: string | null;
}

function getTransactionTypeLabel(type: string | undefined): {
  label: string;
  icon: string;
} {
  const t = type || 'NORMAL';
  const types: Record<string, { label: string; icon: string }> = {
    NORMAL: { label: 'רגילה', icon: '💳' },
    INSTALLMENTS: { label: 'תשלומים', icon: '📅' },
    CREDIT: { label: 'זיכוי', icon: '💰' },
    REFUND: { label: 'החזר', icon: '↩️' },
    CASH: { label: 'מזומן', icon: '💵' },
    TRANSFER: { label: 'העברה', icon: '🔄' },
    FEE: { label: 'עמלה', icon: '🏦' },
    INTEREST: { label: 'ריבית', icon: '📈' },
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

function CategoryEditor({
  categoryOptions,
  onPickCategory,
  onCancelEditCategory,
}: {
  categoryOptions: TransactionRowCategoryOption[];
  onPickCategory: (categoryId: string) => void;
  onCancelEditCategory: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <select
        className="max-w-full min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
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
  );
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

  const bankDate = new Date(transaction.date);
  let formattedDate: string;
  try {
    formattedDate = format(bankDate, 'd MMM yyyy', { locale: he });
  } catch {
    formattedDate = transaction.date;
  }

  let budgetAnchorHint: string | null = null;
  if (transaction.effectiveDate) {
    try {
      const eff = new Date(transaction.effectiveDate);
      if (!isSameDay(bankDate, eff)) {
        budgetAnchorHint = format(eff, 'd MMM yyyy', { locale: he });
      }
    } catch {
      budgetAnchorHint = null;
    }
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

  const hasChips =
    (transaction.isAbroad &&
      transaction.foreignCurrencyDisplay &&
      transaction.originalCurrency) ||
    showTypeBadge ||
    isPending ||
    hasInstallments ||
    isExcluded;

  const categoryCell =
    isEditingCategory && categoryOptions && onPickCategory && onCancelEditCategory ? (
      <CategoryEditor
        categoryOptions={categoryOptions}
        onPickCategory={onPickCategory}
        onCancelEditCategory={onCancelEditCategory}
      />
    ) : (
      <button
        type="button"
        onClick={() => onChangeCategory(transaction.id)}
        className="w-full text-end transition-opacity hover:opacity-80"
      >
        <TransactionCategoryBadge transaction={transaction} className="max-w-full" />
      </button>
    );

  return (
    <div
      className={cn(
        'transaction-row-grid group relative border-b border-border p-4 transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5',
        isExcluded && 'opacity-60',
        isPending && 'border-e-2 border-pending bg-pending/10',
        TRANSACTION_LIST_GRID_CLASS,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          TXN_COL_AVATAR,
          'flex h-10 w-10 items-center justify-center rounded-full text-lg',
        )}
        style={{
          backgroundColor:
            categoryTint.startsWith('#') ? `${categoryTint}33` : 'hsl(var(--muted) / 0.2)',
          color: categoryTint,
        }}
      >
        {transaction.category?.icon || '❓'}
      </div>

      {/* Content: title, chips, meta, note, mobile category */}
      <div className={cn(TXN_COL_CONTENT, 'space-y-1')}>
        <p className="ellipsis-1 text-base font-semibold leading-snug text-foreground">
          {transaction.description}
        </p>

        {hasChips ? (
          <div className="txn-chips-lane" aria-label="תגיות עסקה">
            {transaction.isAbroad &&
            transaction.foreignCurrencyDisplay &&
            transaction.originalCurrency ? (
              <ForeignCurrencyBadge
                className="txn-chip max-w-[10rem] border-0 bg-transparent p-0"
                originalCurrency={transaction.originalCurrency}
                foreignCurrencyDisplay={transaction.foreignCurrencyDisplay}
                exchangeRate={
                  transaction.exchangeRate != null
                    ? Number(transaction.exchangeRate)
                    : null
                }
              />
            ) : null}
            {showTypeBadge ? (
              <span className="txn-chip">
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
              <Badge variant="outline" className="txn-chip border-dashed font-normal">
                תשלום {transaction.installmentNumber}/{transaction.installmentTotal}
              </Badge>
            ) : null}
            {isExcluded ? (
              <Badge variant="outline" className="txn-chip border-dashed font-normal">
                לא בתקציב
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="meta-line flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span>{formattedDate}</span>
          {budgetAnchorHint ? (
            <span
              className="opacity-90"
              title="ייחוס לתקציב (למשל משכורת בסוף החודש)"
            >
              · בתקציב: {budgetAnchorHint}
            </span>
          ) : null}
          {transaction.account ? (
            <>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1">
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
              <span aria-hidden>•</span>
              <span className="font-mono tabular-nums" dir="ltr">
                {String(transaction.account.accountNumber).slice(-4)}
              </span>
            </>
          ) : null}
        </div>

        {transaction.note ? (
          <div className="meta-line flex items-start gap-1">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <p className="ellipsis-1 italic" title={transaction.note}>
              {transaction.note}
            </p>
          </div>
        ) : null}

        <div className="pt-1 md:hidden">{categoryCell}</div>
      </div>

      {/* Amount — fixed column, LTR isolated */}
      <div className={TXN_COL_AMOUNT}>
        <Amount value={amount} size="lg" showSign={false} className="block" />
        {!transaction.isAbroad &&
        orig != null &&
        !Number.isNaN(orig) &&
        origCur !== 'ILS' ? (
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            <span dir="ltr" className="inline-block">
              {origCur} {orig.toFixed(2)}
            </span>
          </p>
        ) : null}
      </div>

      {/* Category — desktop column */}
      <div className={cn(TXN_COL_CATEGORY, 'hidden md:block')}>{categoryCell}</div>

      {/* Actions */}
      <div
        className={cn(
          TXN_COL_ACTIONS,
          'transition-opacity',
          isHovered ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100',
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
