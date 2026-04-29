import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ForeignCurrencyBadgeProps {
  originalCurrency: string;
  foreignCurrencyDisplay: string;
  exchangeRate: number | null;
  className?: string;
}

export function ForeignCurrencyBadge({
  originalCurrency,
  foreignCurrencyDisplay,
  exchangeRate,
  className,
}: ForeignCurrencyBadgeProps) {
  const cur = originalCurrency.trim().toUpperCase();
  const tip = [
    'עסקה מחו"ל',
    `סכום מקורי: ${foreignCurrencyDisplay}`,
    exchangeRate != null && Number.isFinite(exchangeRate)
      ? `שער משוער: ₪${exchangeRate.toFixed(4)} ל-1 ${cur}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      title={tip}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-sm border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground',
        className,
      )}
    >
      <Globe className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="shrink-0 tabular-nums text-muted-foreground">{cur}</span>
      <span className="truncate tabular-nums">{foreignCurrencyDisplay}</span>
    </span>
  );
}
