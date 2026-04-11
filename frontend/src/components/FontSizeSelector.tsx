import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Type } from 'lucide-react';

const fontSizes = [
  { value: 'small', label: 'קטן', size: 'text-sm' },
  { value: 'base', label: 'רגיל', size: 'text-base' },
  { value: 'large', label: 'גדול', size: 'text-lg' },
  { value: 'xlarge', label: 'גדול מאוד', size: 'text-xl' },
] as const;

export function FontSizeSelector() {
  const { fontSize, setFontSize } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Type className="h-4 w-4" />
        <span>גודל טקסט</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {fontSizes.map((s) => (
          <Button
            key={s.value}
            variant={fontSize === s.value ? 'default' : 'outline'}
            size="sm"
            type="button"
            onClick={() => setFontSize(s.value)}
            className={cn('min-w-[4.5rem] flex-1 sm:flex-none', s.size)}
          >
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
