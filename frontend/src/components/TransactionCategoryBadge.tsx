import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TransactionCategoryBadgeTx {
  categoryId?: string | null;
  category?: {
    id?: string | null;
    name?: string;
    nameHe?: string;
    icon?: string;
    color?: string;
  } | null;
}

export function getCategoryDisplay(transaction: TransactionCategoryBadgeTx) {
  if (
    !transaction.category ||
    transaction.categoryId == null ||
    transaction.category.name === 'uncategorized'
  ) {
    return {
      name: 'לא מסווג',
      icon: '❓',
      color: '#64748b',
    };
  }
  return {
    name: transaction.category.nameHe || transaction.category.name || 'לא מסווג',
    icon: transaction.category.icon || '📁',
    color: transaction.category.color || '#64748b',
  };
}

interface TransactionCategoryBadgeProps {
  transaction: TransactionCategoryBadgeTx;
  className?: string;
}

export function TransactionCategoryBadge({
  transaction,
  className,
}: TransactionCategoryBadgeProps) {
  const isUncategorized =
    transaction.categoryId == null ||
    !transaction.category ||
    transaction.category.name === 'uncategorized';

  const display = isUncategorized
    ? { name: 'לא מסווג', icon: '❓', color: '#64748b' }
    : {
        name:
          transaction.category?.nameHe ||
          transaction.category?.name ||
          'לא מסווג',
        icon: transaction.category?.icon || '📁',
        color: transaction.category?.color || '#64748b',
      };

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-normal',
        isUncategorized && 'border-dashed opacity-80',
        className,
      )}
      style={{ borderColor: display.color, color: display.color }}
    >
      <span className="ms-1" aria-hidden>
        {display.icon}
      </span>
      {display.name}
    </Badge>
  );
}
