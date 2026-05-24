import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('יישמר בקרוב');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--border)] bg-[var(--panel)] text-[var(--fg)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עסקה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tx-desc">תיאור</Label>
            <Input id="tx-desc" placeholder="תיאור העסקה" className="bg-[var(--panel-hi)]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-amount">סכום</Label>
            <Input id="tx-amount" type="text" placeholder="₪0.00" dir="ltr" className="tabular-nums bg-[var(--panel-hi)]" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" className="bg-[var(--accent-primary)] text-white hover:opacity-90">
              שמור
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
