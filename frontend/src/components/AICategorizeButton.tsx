import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Wand2, Loader2, Check } from 'lucide-react';
import { ollamaApi, settingsApi } from '@/services/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { isAxiosError } from 'axios';

interface Suggestion {
  transactionId: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  confidence: number;
  reasoning: string;
  description?: string;
  amount?: number;
  currentCategory?: string;
}

interface AICategorizeButtonProps {
  mode: 'uncategorized' | 'improve';
  onComplete?: () => void;
}

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const d = err.response?.data as { message?: string | string[] } | undefined;
    if (typeof d?.message === 'string') return d.message;
    if (Array.isArray(d?.message)) return d.message.join(', ');
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function AICategorizeButton({ mode, onComplete }: AICategorizeButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'idle' | 'scanning' | 'reviewing' | 'applying'>(
    'idle',
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      settingsApi.get().then(
        (res) =>
          res.data as {
            ollamaEnabled?: boolean;
            ollamaUrl?: string | null;
          },
      ),
  });

  const isOllamaEnabled =
    settings?.ollamaEnabled === true && Boolean(settings?.ollamaUrl?.trim());

  const scanMutation = useMutation({
    mutationFn: async () => {
      setStep('scanning');
      setProgress(10);

      const { transactionIds } =
        mode === 'uncategorized'
          ? await ollamaApi.getUncategorized(30)
          : await ollamaApi.getForImprovement(30);

      if (!transactionIds.length) {
        throw new Error(
          mode === 'uncategorized'
            ? 'אין עסקאות לא מסווגות'
            : 'אין עסקאות לשיפור',
        );
      }

      setProgress(30);

      const { suggestions: result } = await ollamaApi.categorize(
        transactionIds,
        mode,
      );

      setProgress(100);
      return result as Suggestion[];
    },
    onSuccess: (result) => {
      if (!result.length) {
        toast.message('לא נמצאו הצעות סיווג חדשות');
        setStep('idle');
        setIsOpen(false);
        return;
      }
      setSuggestions(result);
      setSelectedIds(new Set(result.map((s) => s.transactionId)));
      setStep('reviewing');
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'שגיאה בסריקה'));
      setStep('idle');
      setIsOpen(false);
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      setStep('applying');

      const toApply = suggestions
        .filter((s) => selectedIds.has(s.transactionId))
        .map((s) => ({
          transactionId: s.transactionId,
          categoryId: s.suggestedCategoryId,
        }));

      return ollamaApi.applySuggestions(toApply) as Promise<{ updated: number }>;
    },
    onSuccess: ({ updated }) => {
      toast.success(`סווגו ${updated} עסקאות בהצלחה`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsOpen(false);
      setStep('idle');
      setSuggestions([]);
      setSelectedIds(new Set());
      onComplete?.();
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, 'שגיאה בהחלת הסיווג'));
      setStep('reviewing');
    },
  });

  const handleOpen = () => {
    setIsOpen(true);
    scanMutation.mutate();
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map((s) => s.transactionId)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  return (
    <>
      <Button
        type="button"
        variant={mode === 'uncategorized' ? 'default' : 'outline'}
        size="sm"
        onClick={handleOpen}
        disabled={!isOllamaEnabled}
        title={
          !isOllamaEnabled ? 'יש להפעיל Ollama בהגדרות אינטגרציות' : undefined
        }
      >
        {mode === 'uncategorized' ? (
          <>
            <Sparkles className="ms-2 h-4 w-4" />
            סיווג אוטומטי
          </>
        ) : (
          <>
            <Wand2 className="ms-2 h-4 w-4" />
            סיווג מתקדם
          </>
        )}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setStep('idle');
            setSuggestions([]);
            setSelectedIds(new Set());
            setProgress(0);
          }
        }}
      >
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {mode === 'uncategorized' ? 'סיווג אוטומטי' : 'שיפור סיווג'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'uncategorized'
                ? 'ה-AI יסווג עסקאות ללא קטגוריה'
                : 'ה-AI ינסה לשפר את הסיווג של עסקאות קיימות'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {step === 'scanning' && (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="text-center text-muted-foreground">
                  סורק עסקאות ומסווג עם AI...
                </p>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {step === 'reviewing' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    נמצאו {suggestions.length} הצעות סיווג
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" type="button" onClick={selectAll}>
                      בחר הכל
                    </Button>
                    <Button variant="ghost" size="sm" type="button" onClick={deselectAll}>
                      נקה בחירה
                    </Button>
                  </div>
                </div>

                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.transactionId}
                      className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedIds.has(suggestion.transactionId)}
                        onCheckedChange={() =>
                          toggleSelection(suggestion.transactionId)
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            {suggestion.description || 'עסקה'}
                          </span>
                          {suggestion.amount != null && (
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(Number(suggestion.amount))}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {suggestion.currentCategory && mode === 'improve' && (
                            <>
                              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                                {suggestion.currentCategory}
                              </span>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <span className="rounded-md bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                            {suggestion.suggestedCategoryName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(suggestion.confidence * 100)}% ביטחון)
                          </span>
                        </div>
                        {suggestion.reasoning ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {suggestion.reasoning}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'applying' && (
              <div className="space-y-4 py-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <p className="text-center text-muted-foreground">
                  מחיל סיווג על {selectedIds.size} עסקאות...
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {step === 'reviewing' && (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsOpen(false)}
                >
                  ביטול
                </Button>
                <Button
                  type="button"
                  onClick={() => applyMutation.mutate()}
                  disabled={selectedIds.size === 0 || applyMutation.isPending}
                >
                  <Check className="ms-2 h-4 w-4" />
                  החל סיווג ({selectedIds.size})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
