import { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, Bot, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  categorizationApi,
  type CategorizationResult,
  type CategorizationSummary,
} from '@/services/api';
import { cn } from '@/lib/utils';

type Step = 'select' | 'quick-progress' | 'quick-results' | 'applying';
type RunMode = 'quick' | 'smart' | null;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  /** פותח את המודאל ומתחיל מיד את הזרימה (ללא מסך הבחירה) */
  launchWith?: 'quick' | 'smart' | null;
  onLaunchConsumed?: () => void;
}

export function CategorizationModal({
  open,
  onOpenChange,
  onComplete,
  launchWith = null,
  onLaunchConsumed,
}: Props) {
  const [step, setStep] = useState<Step>('select');
  const [summary, setSummary] = useState<CategorizationSummary | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(
    new Set(),
  );
  const [expandedResults, setExpandedResults] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [runMode, setRunMode] = useState<RunMode>(null);
  const wasOpenRef = useRef(false);

  const selectHighConfidence = useCallback((s: CategorizationSummary) => {
    const next = new Set<string>();
    for (const r of s.results) {
      if (!r.suggestedCategoryId) continue;
      if (r.source === 'ai') {
        if (r.confidence >= 0.7) next.add(r.transactionId);
      } else if (r.confidence >= 0.8) {
        next.add(r.transactionId);
      }
    }
    setSelectedResults(next);
  }, []);

  const handleQuickCategorize = useCallback(async () => {
    setRunMode('quick');
    setStep('quick-progress');
    setProgress(0);
    setError(null);
    const tick = window.setInterval(() => {
      setProgress((p) => Math.min(p + 12, 88));
    }, 220);
    try {
      const result = await categorizationApi.quickCategorize();
      window.clearInterval(tick);
      setProgress(100);
      setSummary(result);
      selectHighConfidence(result);
      setStep('quick-results');
    } catch {
      window.clearInterval(tick);
      setError('שגיאה בסיווג מהיר');
      setStep('select');
    }
  }, [selectHighConfidence]);

  const handleSmartCategorize = useCallback(async () => {
    setRunMode('smart');
    setStep('quick-progress');
    setProgress(0);
    setError(null);
    const tick = window.setInterval(() => {
      setProgress((p) => Math.min(p + 4, 92));
    }, 400);
    try {
      const result = await categorizationApi.smartCategorize();
      window.clearInterval(tick);
      setProgress(100);
      setSummary(result);
      selectHighConfidence(result);
      setStep('quick-results');
    } catch {
      window.clearInterval(tick);
      setError('שגיאה בסיווג חכם');
      setStep('select');
    }
  }, [selectHighConfidence]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setStep('select');
      setSummary(null);
      setSelectedResults(new Set());
      setExpandedResults(false);
      setError(null);
      setProgress(0);
      setRunMode(null);
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !launchWith) return;
    onLaunchConsumed?.();
    if (launchWith === 'quick') void handleQuickCategorize();
    else void handleSmartCategorize();
  }, [
    open,
    launchWith,
    onLaunchConsumed,
    handleQuickCategorize,
    handleSmartCategorize,
  ]);

  const handleApply = async () => {
    if (!summary) return;
    const toApply = summary.results
      .filter(
        (r) => selectedResults.has(r.transactionId) && r.suggestedCategoryId,
      )
      .map((r) => ({
        transactionId: r.transactionId,
        categoryId: r.suggestedCategoryId!,
        source: r.source,
      }));

    if (toApply.length === 0) {
      onOpenChange(false);
      return;
    }

    setStep('applying');
    setProgress(0);
    const tick = window.setInterval(() => {
      setProgress((p) => Math.min(p + 25, 90));
    }, 200);
    try {
      await categorizationApi.applyResults(toApply);
      window.clearInterval(tick);
      setProgress(100);
      onComplete();
      onOpenChange(false);
    } catch {
      window.clearInterval(tick);
      setError('שגיאה בהחלת סיווגים');
      setStep('quick-results');
    }
  };

  const toggleResult = (transactionId: string) => {
    const next = new Set(selectedResults);
    if (next.has(transactionId)) next.delete(transactionId);
    else next.add(transactionId);
    setSelectedResults(next);
  };

  const selectAllWithSuggestions = () => {
    if (!summary) return;
    setSelectedResults(
      new Set(
        summary.results
          .filter((r) => r.suggestedCategoryId)
          .map((r) => r.transactionId),
      ),
    );
  };

  const withSuggestions =
    summary?.results.filter((r) => r.suggestedCategoryId) ?? [];

  const titleForStep = () => {
    switch (step) {
      case 'select':
        return 'סיווג חכם';
      case 'quick-progress':
        return runMode === 'smart' ? 'סיווג חכם בתהליך' : 'סיווג בתהליך';
      case 'applying':
        return 'מחיל שינויים';
      case 'quick-results':
        return 'תוצאות סיווג';
      default:
        return 'סיווג';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-start">
          <DialogTitle className="text-lg">{titleForStep()}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error ? (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {step === 'select' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                סיווג מהיר — רק מיפוי והיסטוריה. סיווג חכם — אותו דבר ואז AI
                במנות לעסקאות שנותרו ללא קטגוריה (דורש מנוע AI פעיל).
              </p>
              <button
                type="button"
                onClick={() => void handleQuickCategorize()}
                className="w-full cursor-pointer rounded-sm border-2 border-border bg-card p-4 text-start transition-colors duration-200 hover:border-foreground/40"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">סיווג מהיר</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                    מומלץ
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  מיפוי ספקים + היסטוריה — ללא AI
                </p>
              </button>
              <button
                type="button"
                onClick={() => void handleSmartCategorize()}
                className="w-full cursor-pointer rounded-sm border-2 border-border bg-card p-4 text-start transition-colors duration-200 hover:border-foreground/40"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-sky-500" />
                  <span className="font-medium">סיווג חכם</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  מיפוי + היסטוריה + AI (מנות) לעסקאות שלא סווגו
                </p>
              </button>
            </div>
          ) : null}

          {(step === 'quick-progress' || step === 'applying') && (
            <div className="space-y-4 py-6 text-center">
              {step === 'quick-progress' ? (
                runMode === 'smart' ? (
                  <Bot className="mx-auto h-10 w-10 animate-pulse text-sky-500" />
                ) : (
                  <Zap className="mx-auto h-10 w-10 animate-pulse text-amber-500" />
                )
              ) : null}
              {step === 'applying' ? (
                <Check className="mx-auto h-10 w-10 text-green-600" />
              ) : null}
              <p className="text-sm text-muted-foreground">
                {step === 'quick-progress' && runMode === 'smart'
                  ? 'מיפוי, היסטוריה וסיווג AI במנות...'
                  : null}
                {step === 'quick-progress' && runMode !== 'smart'
                  ? 'סורק התאמות היסטוריות ומיפוי ספקים...'
                  : null}
                {step === 'applying' ? 'מעדכן קטגוריות...' : null}
              </p>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {step === 'quick-results' && summary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                  <div className="text-xl font-semibold text-foreground">
                    {summary.categorized.mapping +
                      summary.categorized.historical}
                  </div>
                  <div className="text-xs text-muted-foreground">מהיסטוריה</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                  <div className="text-xl font-semibold text-foreground">
                    {summary.categorized.ai}
                  </div>
                  <div className="text-xs text-muted-foreground">מ־AI</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                  <div className="text-xl font-semibold text-muted-foreground">
                    {summary.uncategorized}
                  </div>
                  <div className="text-xs text-muted-foreground">לא זוהו</div>
                </div>
              </div>

              {withSuggestions.length > 0 ? (
                <div>
                  <button
                    type="button"
                    className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedResults(!expandedResults)}
                  >
                    {expandedResults ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    הצג {withSuggestions.length} המלצות
                  </button>
                  {expandedResults ? (
                    <div className="max-h-60 space-y-2 overflow-y-auto pe-1">
                      {withSuggestions.map((result: CategorizationResult) => (
                        <div
                          key={result.transactionId}
                          className={cn(
                            'flex gap-3 rounded-lg border p-3 transition-colors',
                            selectedResults.has(result.transactionId)
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border bg-card',
                          )}
                        >
                          <Checkbox
                            checked={selectedResults.has(
                              result.transactionId,
                            )}
                            onCheckedChange={() =>
                              toggleResult(result.transactionId)
                            }
                            aria-label="בחר הצעה"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="truncate font-medium">
                                {result.description}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ₪{Math.abs(result.amount).toFixed(0)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-primary">
                                {result.suggestedCategoryName}
                              </span>
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-xs',
                                  result.confidence >= 0.8
                                    ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                                    : result.confidence >= 0.5
                                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400'
                                      : 'bg-red-500/15 text-red-700 dark:text-red-400',
                                )}
                              >
                                {Math.round(result.confidence * 100)}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {result.source === 'mapping'
                                  ? 'מיפוי'
                                  : result.source === 'historical'
                                    ? 'היסטוריה'
                                    : result.source === 'ai'
                                      ? 'AI'
                                      : ''}
                              </span>
                            </div>
                            {result.aiReasoning ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {result.aiReasoning}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {summary.aiUsed && summary.aiBatches != null ? (
                <p className="text-center text-xs text-muted-foreground">
                  סיווג חכם: {summary.aiBatches} מנות AI
                  {summary.aiErrors?.length
                    ? ` · ${summary.aiErrors.length} אזהרות`
                    : ''}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {step === 'quick-results' && summary ? (
          <DialogFooter className="border-t border-border px-4 py-3 sm:flex-row-reverse sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllWithSuggestions}
              >
                בחר הכל
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedResults.size} נבחרו
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ביטול
              </Button>
              <Button
                type="button"
                onClick={() => void handleApply()}
                disabled={selectedResults.size === 0}
              >
                <Check className="me-2 h-4 w-4" />
                החל ({selectedResults.size})
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
