import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  CHF: '🇨🇭',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  TRY: '🇹🇷',
  THB: '🇹🇭',
  CNY: '🇨🇳',
  INR: '🇮🇳',
  RUB: '🇷🇺',
  PLN: '🇵🇱',
  CZK: '🇨🇿',
  SEK: '🇸🇪',
  NOK: '🇳🇴',
  DKK: '🇩🇰',
};

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
  const flag = CURRENCY_FLAGS[cur] || '🌍';
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
        'inline-flex max-w-full items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-800 dark:text-sky-300',
        className,
      )}
    >
      <Globe className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="shrink-0">{flag}</span>
      <span className="truncate tabular-nums">{foreignCurrencyDisplay}</span>
    </span>
  );
}
