import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  History,
  ExternalLink,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { versionApi } from '@/services/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  releaseUrl?: string;
}

interface UpdateStatus {
  status: 'idle' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'rolled-back';
  message: string;
  currentVersion: string;
  targetVersion?: string;
  progress?: number;
  error?: string;
  startedAt?: string;
  buildLog?: string[];
  updatedAt?: string;
}

interface UpdateHistoryEntry {
  version: string;
  previousVersion: string;
  timestamp: string;
  status: 'success' | 'failed' | 'rolled-back';
  duration: number;
  error?: string;
}

export function UpdateSection() {
  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [history, setHistory] = useState<UpdateHistoryEntry[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [polling, setPolling] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showBuildLog, setShowBuildLog] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await versionApi.getUpdateStatus();
      setUpdateStatus(data as UpdateStatus);
      const active = data.status === 'in-progress' || data.status === 'pending';
      setPolling(active);
      return data as UpdateStatus;
    } catch {
      return null;
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const { data } = await versionApi.checkForUpdate();
      setUpdateInfo(data as UpdateInfo);

      if (data.updateAvailable) {
        toast.success(`עדכון זמין: ${data.latestVersion}`);
      } else {
        toast.message(`המערכת מעודכנת (${data.currentVersion})`);
      }
    } catch {
      toast.error('לא ניתן לבדוק עדכונים');
    } finally {
      setChecking(false);
    }
  }, []);

  const triggerUpdate = useCallback(async () => {
    setShowConfirmDialog(false);
    setShowBuildLog(true);
    try {
      const { data } = await versionApi.triggerUpdate();
      if (data.triggered) {
        toast.success(data.message);
        setPolling(true);
        await fetchStatus();
      } else {
        toast.error(data.message);
        setShowBuildLog(false);
      }
    } catch {
      toast.error('לא ניתן להפעיל עדכון');
      setShowBuildLog(false);
    }
  }, [fetchStatus]);

  const cancelUpdate = useCallback(async () => {
    try {
      const { data } = await versionApi.cancelUpdate();
      if (data.cancelled) {
        toast.success('העדכון בוטל');
        setShowBuildLog(false);
        setPolling(false);
        await fetchStatus();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('לא ניתן לבטל עדכון');
    }
  }, [fetchStatus]);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await versionApi.getUpdateHistory();
      setHistory(Array.isArray(data) ? (data as UpdateHistoryEntry[]) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const clearBuildLogMutation = useMutation({
    mutationFn: () => versionApi.clearBuildLog().then((res) => res.data),
    onSuccess: (data) => {
      if (data.cleared) {
        toast.success('לוג הבנייה נוקה');
        void fetchStatus();
      } else {
        toast.error('לא ניתן לנקות את לוג הבנייה');
      }
    },
    onError: () => toast.error('שגיאה בניקוי לוג הבנייה'),
  });

  const buildLog = updateStatus?.buildLog ?? [];

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [buildLog, autoScroll]);

  useEffect(() => {
    void fetchStatus();
    void checkForUpdates();
  }, [fetchStatus, checkForUpdates]);

  useEffect(() => {
    const st = updateStatus?.status;
    if (st === 'pending' || st === 'in-progress') {
      setShowBuildLog(true);
    }
    if (st === 'failed' || st === 'rolled-back') {
      setShowBuildLog(true);
    }
    if (st === 'idle' || st === 'completed') {
      setShowBuildLog(false);
    }
  }, [updateStatus?.status]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      void fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  const isUpdating = useMemo(
    () => updateStatus?.status === 'in-progress' || updateStatus?.status === 'pending',
    [updateStatus],
  );

  const statusNode = useMemo(() => {
    if (!updateStatus || updateStatus.status === 'idle') return null;

    if (updateStatus.status === 'pending') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-yellow-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>ממתין להתחלה...</span>
          </div>
          {updateStatus.progress !== undefined ? (
            <Progress value={updateStatus.progress} className="h-2" />
          ) : (
            <Progress value={5} className="h-2 opacity-70" />
          )}
        </div>
      );
    }

    if (updateStatus.status === 'in-progress') {
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-blue-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{updateStatus.message}</span>
            {updateStatus.progress !== undefined ? (
              <span className="text-xs text-muted-foreground">
                {Math.round(updateStatus.progress)}%
              </span>
            ) : null}
          </div>
          {updateStatus.progress !== undefined ? (
            <Progress value={updateStatus.progress} className="h-2" />
          ) : (
            <Progress value={15} className="h-2 opacity-70" />
          )}
        </div>
      );
    }

    if (updateStatus.status === 'completed') {
      return (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>העדכון הושלם בהצלחה!</span>
        </div>
      );
    }

    if (updateStatus.status === 'failed') {
      return (
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="h-4 w-4" />
          <span>העדכון נכשל: {updateStatus.error ?? 'שגיאה לא ידועה'}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-orange-400">
        <RotateCcw className="h-4 w-4" />
        <span>בוצע rollback לגרסה קודמת</span>
      </div>
    );
  }, [updateStatus]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">גרסה נוכחית</h4>
            <p className="text-2xl font-bold text-primary">
              {updateInfo?.currentVersion ?? updateStatus?.currentVersion ?? '...'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchHistory();
                setShowHistoryDialog(true);
              }}
            >
              <History className="me-2 h-4 w-4" />
              היסטוריה
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void checkForUpdates()}
              disabled={checking || isUpdating}
            >
              {checking ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="me-2 h-4 w-4" />
              )}
              בדוק עדכונים
            </Button>
          </div>
        </div>
      </Card>

      {statusNode ? (
        <Card className="p-4">
          {statusNode}

          {updateStatus &&
          showBuildLog &&
          ['pending', 'in-progress', 'failed', 'rolled-back'].includes(
            updateStatus.status,
          ) ? (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-muted-foreground">לוג בנייה:</h4>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                      className="rounded border-gray-600"
                    />
                    גלילה אוטומטית
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    disabled={
                      clearBuildLogMutation.isPending ||
                      updateStatus.status === 'in-progress'
                    }
                    onClick={() => clearBuildLogMutation.mutate()}
                  >
                    <Trash2 className="me-1 h-3 w-3" />
                    נקה
                  </Button>
                </div>
              </div>
              <div
                ref={logContainerRef}
                className="h-48 max-h-48 w-full overflow-y-auto rounded-md border bg-black/80 p-3"
              >
                {buildLog.length === 0 ? (
                  <p
                    dir="ltr"
                    className="text-start font-mono text-xs text-muted-foreground"
                  >
                    ממתין לשורות לוג מהשרת (העדכון יתחיל בקרוב)...
                  </p>
                ) : (
                  <div
                    dir="ltr"
                    style={{ textAlign: 'left' }}
                    className="font-mono space-y-0.5 text-xs"
                  >
                    {buildLog.map((line, index) => (
                      <div
                        key={`${index}-${line.slice(0, 24)}`}
                        className={cn(
                          'whitespace-pre',
                          /ERROR|error|failed/i.test(line)
                            ? 'text-red-400'
                            : /WARN|warning/i.test(line)
                              ? 'text-yellow-400'
                              : /SUCCESS|✓/i.test(line)
                                ? 'text-green-400'
                                : 'text-gray-300',
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {updateStatus && ['failed', 'rolled-back'].includes(updateStatus.status) && updateStatus.error ? (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <h4 className="text-destructive mb-1 text-sm font-medium">שגיאה:</h4>
              <p className="text-destructive/80 text-sm">{updateStatus.error}</p>
            </div>
          ) : null}

          {updateStatus &&
          (updateStatus.status === 'pending' ||
            (updateStatus.status === 'in-progress' &&
              (updateStatus.progress ?? 0) <= 50)) ? (
            <div className="mt-3">
              <Button variant="destructive" size="sm" onClick={() => void cancelUpdate()}>
                בטל עדכון
              </Button>
            </div>
          ) : null}

          {updateStatus?.status === 'completed' ? (
            <div className="mt-3">
              <Button size="sm" onClick={() => window.location.reload()}>
                רענן את הדף
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {updateInfo?.updateAvailable && !isUpdating ? (
        <Card className="border-primary/50 bg-primary/5 p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/20 p-2">
              <Download className="h-6 w-6 text-primary" />
            </div>

            <div className="flex-1">
              <h4 className="font-medium">עדכון זמין!</h4>
              <p className="text-sm text-muted-foreground">
                גרסה {updateInfo.latestVersion} זמינה להורדה
              </p>

              {updateInfo.releaseNotes ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-primary hover:underline">
                    הצג פרטי גרסה
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white/5 p-3 text-sm">
                    {updateInfo.releaseNotes}
                  </div>
                </details>
              ) : null}

              <div className="mt-3 flex items-center gap-2">
                <Button onClick={() => setShowConfirmDialog(true)}>
                  <Download className="me-2 h-4 w-4" />
                  עדכן עכשיו
                </Button>

                {updateInfo.releaseUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(updateInfo.releaseUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="me-2 h-4 w-4" />
                    GitHub
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור עדכון</DialogTitle>
            <DialogDescription>
              האם להתחיל בעדכון לגרסה {updateInfo?.latestVersion}?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">שים לב:</p>
                <ul className="mt-1 space-y-1 text-muted-foreground">
                  <li>• האפליקציה תהיה לא זמינה למספר דקות</li>
                  <li>• מומלץ לוודא שאין פעולות פתוחות</li>
                  <li>• במקרה של כשל, תתבצע חזרה אוטומטית לגרסה הקודמת</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
              ביטול
            </Button>
            <Button onClick={() => void triggerUpdate()}>
              <Download className="me-2 h-4 w-4" />
              התחל עדכון
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>היסטוריית עדכונים</DialogTitle>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">אין היסטוריית עדכונים</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div key={`${entry.timestamp}-${idx}`} className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                    {entry.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : entry.status === 'rolled-back' ? (
                      <RotateCcw className="h-5 w-5 text-orange-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.version}</span>
                        <span className="text-xs text-muted-foreground">מ-{entry.previousVersion}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString('he-IL')} • {Math.round(entry.duration / 60)} דקות
                      </p>
                      {entry.error ? (
                        <p className="mt-1 text-xs text-red-400">{entry.error}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
