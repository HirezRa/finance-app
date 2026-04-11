import { cn, formatCurrency } from '@/lib/utils';

interface AmountProps {
  value: number;
  showSign?: boolean;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | 'hero';
  className?: string;
}

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  hero: 'text-4xl md:text-5xl',
};

export function Amount({
  value,
  showSign = true,
  size = 'base',
  className,
}: AmountProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const formattedValue = formatCurrency(Math.abs(value));
  const sign = showSign ? (isPositive ? '+' : isNegative ? '-' : '') : '';

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium tabular-nums',
        sizeClasses[size],
        isPositive && 'text-income',
        isNegative && 'text-expense',
        !isPositive && !isNegative && 'text-foreground',
        className,
      )}
      dir="ltr"
    >
      {sign ? <span className="me-0.5">{sign}</span> : null}
      {formattedValue}
    </span>
  );
}
