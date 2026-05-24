import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CmdKPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CmdKPalette({ open, onOpenChange }: CmdKPaletteProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border)] bg-[var(--panel)] text-[var(--fg)]">
        <DialogHeader>
          <DialogTitle className="text-sm text-[var(--dim)]">חיפוש מהיר</DialogTitle>
        </DialogHeader>
        <input
          type="search"
          readOnly
          placeholder="חפש עסקה, מסחר, סכום… (בקרוב)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-hi)] px-3 py-2 text-sm text-[var(--fg)] outline-none"
          autoFocus
        />
        <p className="text-xs text-[var(--dim)]">⌘K — פלטת פקודות. חיפוש אמיתי יתווסף בהמשך.</p>
      </DialogContent>
    </Dialog>
  );
}
