import { useState, useId } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecretInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** יש ערך שמור בשרת — מוצג מוסתר עד מיקוד */
  hasExistingValue?: boolean;
  className?: string;
  disabled?: boolean;
  autoComplete?: string;
}

export function SecretInput({
  id: propId,
  value,
  onChange,
  placeholder,
  hasExistingValue = false,
  className,
  disabled,
  autoComplete = 'off',
}: SecretInputProps) {
  const genId = useId();
  const inputId = propId ?? `secret-${genId}`;
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);

  const showPlaceholderMask =
    hasExistingValue && !editing && value.length === 0;

  return (
    <div className="relative">
      <Input
        id={inputId}
        type={revealed ? 'text' : 'password'}
        value={showPlaceholderMask ? '' : value}
        readOnly={showPlaceholderMask}
        onChange={(e) => {
          setEditing(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (showPlaceholderMask) {
            setEditing(true);
          }
        }}
        onBlur={() => {
          if (value.length === 0 && hasExistingValue) {
            setEditing(false);
          }
        }}
        placeholder={
          showPlaceholderMask ? '••••••••••••' : (placeholder ?? '')
        }
        dir="ltr"
        disabled={disabled}
        autoComplete={autoComplete}
        className={cn('pe-10 font-mono text-sm', className)}
        aria-describedby={
          hasExistingValue && !editing ? `${inputId}-hint` : undefined
        }
      />
      {hasExistingValue && !editing && value.length === 0 ? (
        <span id={`${inputId}-hint`} className="sr-only">
          מפתח שמור — הקלד ערך חדש להחלפה
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute end-1 top-1/2 h-8 w-8 -translate-y-1/2 shrink-0"
        onClick={() => setRevealed((r) => !r)}
        disabled={disabled || showPlaceholderMask}
        aria-label={revealed ? 'הסתר' : 'הצג'}
      >
        {revealed ? (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Eye className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
