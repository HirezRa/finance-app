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
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-900 shadow-sm backdrop-blur-sm dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200',
        className,
      )}
    >
      <Globe className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="shrink-0">{flag}</span>
      <span className="truncate tabular-nums">{foreignCurrencyDisplay}</span>
    </span>
  );
}
