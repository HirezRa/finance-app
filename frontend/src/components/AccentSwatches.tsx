import { ACCENT_OPTIONS, useTheme, type Accent } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function AccentSwatches({ className }: { className?: string }) {
  const { accent, setAccent } = useTheme();

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {ACCENT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={accent === opt.id}
          onClick={() => setAccent(opt.id as Accent)}
          className={cn(
            'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
            accent === opt.id ? 'border-[var(--fg)] ring-2 ring-[var(--accent-primary)]' : 'border-transparent',
          )}
          style={{ backgroundColor: opt.color }}
        />
      ))}
    </div>
  );
}
