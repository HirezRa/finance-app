const SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  NZD: 'NZ$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  TRY: '₺',
  RUB: '₽',
  CNY: '¥',
  THB: '฿',
  INR: '₹',
  MXN: 'MX$',
  BRL: 'R$',
  ZAR: 'R',
  ILS: '₪',
};

export function formatForeignCurrency(amount: number, currency: string): string {
  const cur = currency.trim().toUpperCase();
  const symbol = SYMBOLS[cur] || cur;
  const absAmount = Math.abs(amount);
  if (cur === 'JPY' || cur === 'KRW') {
    return `${symbol}${Math.round(absAmount).toLocaleString('en-US')}`;
  }
  return `${symbol}${absAmount.toFixed(2)}`;
}

export function buildAbroadPromptLine(tx: {
  isAbroad?: boolean;
  originalCurrency?: string | null;
  originalAmount?: unknown;
  exchangeRate?: unknown;
}): string {
  if (!tx.isAbroad) {
    return 'Location: Israel (charge in ILS).';
  }
  const cur = (tx.originalCurrency || 'UNKNOWN').toString().trim().toUpperCase();
  const orig =
    tx.originalAmount != null ? Number(tx.originalAmount as number | string) : NaN;
  const parts = ['Location: abroad (foreign / FX transaction).'];
  if (Number.isFinite(orig)) {
    parts.push(
      `Original charge: ${formatForeignCurrency(orig, cur)} (${cur}).`,
    );
  } else {
    parts.push(`Original currency code: ${cur}.`);
  }
  const er =
    tx.exchangeRate != null ? Number(tx.exchangeRate as number | string) : NaN;
  if (Number.isFinite(er) && er > 0) {
    parts.push(`Implied FX: ~${er.toFixed(4)} ILS per 1 ${cur} (from bank charge vs original).`);
  }
  return parts.join(' ');
}
