import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { transactionsApi } from '@/services/api';

interface AddTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTransactionModal({ open, onOpenChange }: AddTransactionModalProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const createMutation = useMutation({
    mutationFn: () => {
      const parsed = Number(amount.replace(/,/g, ''));
      if (!description.trim() || Number.isNaN(parsed)) {
        throw new Error('invalid');
      }
      return transactionsApi.create({
        description: description.trim(),
        amount: parsed,
        date: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      toast.success('העסקה נשמרה');
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDescription('');
      setAmount('');
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (err.message === 'invalid') {
        toast.error('נא למלא תיאור וסכום תקינים');
        return;
      }
      toast.error('שמירת העסקה נכשלה');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
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
            <Input
              id="tx-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור העסקה"
              className="bg-[var(--panel-hi)]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-amount">סכום (שלילי להוצאה)</Label>
            <Input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="-100.00"
              dir="ltr"
              className="tabular-nums bg-[var(--panel-hi)]"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[var(--accent-primary)] text-white hover:opacity-90"
            >
              {createMutation.isPending ? 'שומר…' : 'שמור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
