import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Download,
  Github,
  Eye,
  EyeOff,
  Loader2,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api, { settingsApi, versionApi, type PerformSelfUpdateResponse } from '@/services/api';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

interface GithubReleaseApiResponse {
  success: boolean;
  release: GitHubRelease | null;
  messageHe?: string;
  code?: string;
}

interface LatestCheckResult {
  release: GitHubRelease | null;
  infoHe?: string;
}

async function fetchLatestRelease(): Promise<LatestCheckResult> {
  const { data } = await api.get<GithubReleaseApiResponse>('/version/github-release');
  if (!data.success) {
    throw new Error(data.messageHe ?? 'לא ניתן לבדוק עדכונים מול GitHub.');
  }
  return {
    release: data.release,
    infoHe: data.release ? undefined : data.messageHe,
  };
}

async function fetchCurrentVersion(): Promise<string> {
  const { data } = await api.get<{ version: string }>('/version');
  return data.version || '0.0.0';
}

function compareVersions(current: string, latest: string): number {
  const norm = (s: string) =>
    s
      .replace(/^v/i, '')
      .split(/[.+]/u)
      .map((p) => parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const currentParts = norm(current);
  const latestParts = norm(latest);
  const len = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < len; i++) {
    const c = currentParts[i] ?? 0;
    const l = latestParts[i] ?? 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
}

function formatQueryError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (isAxiosError(err)) {
    const d = err.response?.data as { message?: string; messageHe?: string } | undefined;
    if (d && typeof d.messageHe === 'string') return d.messageHe;
    if (d && typeof d.message === 'string') return d.message;
    if (err.message) return err.message;
  }
  return 'שגיאה לא ידועה בבדיקת עדכונים.';
}

const MANUAL_UPDATE_ONE_LINER =
  'cd /opt/finance-app && git pull origin main && docker compose build --no-cache backend frontend && docker compose up -d';

function formatSaveTokenError(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data as { message?: string | string[] } | undefined;
    if (d?.message) {
      return Array.isArray(d.message) ? (d.message[0] ?? '') : d.message;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'שמירת הטוקן נכשלה.';
}

export function VersionChecker() {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [manualUpdateBlock, setManualUpdateBlock] = useState<string | null>(null);
  const sawInProgressRef = useRef(false);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => settingsApi.get().then((res) => res.data as { githubReleaseTokenConfigured?: boolean }),
  });

  const tokenConfigured = settings?.githubReleaseTokenConfigured === true;

  const saveTokenMutation = useMutation({
    mutationFn: (token: string) => settingsApi.saveGithubReleaseToken(token),
    onSuccess: () => {
      toast.success('הטוקן נשמר בהצלחה');
      setTokenDraft('');
      void queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: (err) => {
      toast.error(formatSaveTokenError(err));
    },
  });

  const clearTokenMutation = useMutation({
    mutationFn: () => settingsApi.clearGithubReleaseToken(),
    onSuccess: () => {
      toast.success('הטוקן הוסר');
      void queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
    onError: () => {
      toast.error('הסרת הטוקן נכשלה');
    },
  });

  const { data: updateStatus } = useQuery({
    queryKey: ['self-update-status'],
    queryFn: () => versionApi.getUpdateStatus().then((res) => res.data),
    refetchInterval: isUpdating ? 2500 : false,
    enabled: isUpdating,
  });

  const performUpdateMutation = useMutation({
    mutationFn: () => versionApi.performSelfUpdate().then((res) => res.data),
    onSuccess: (data: PerformSelfUpdateResponse) => {
      if (data.success) {
        toast.success(data.messageHe);
        setManualUpdateBlock(null);
        sawInProgressRef.current = true;
        setIsUpdating(true);
        void queryClient.invalidateQueries({ queryKey: ['self-update-status'] });
      } else {
        toast.error(data.messageHe);
        setManualUpdateBlock(data.instructionsHe ?? MANUAL_UPDATE_ONE_LINER);
      }
    },
    onError: (err: unknown) => {
      if (isAxiosError(err) && err.response?.status === 403) {
        const m = err.response?.data as { message?: string } | undefined;
        toast.error(m?.message ?? 'עדכון אוטומטי אינו מופעל בשרת.');
        setManualUpdateBlock(MANUAL_UPDATE_ONE_LINER);
        return;
      }
      toast.error('שגיאה בהפעלת העדכון');
      setManualUpdateBlock(MANUAL_UPDATE_ONE_LINER);
    },
  });

  useEffect(() => {
    if (!updateStatus) return;
    if (updateStatus.inProgress) {
      sawInProgressRef.current = true;
      return;
    }
    if (!isUpdating || !sawInProgressRef.current) return;

    setIsUpdating(false);
    sawInProgressRef.current = false;

    if (updateStatus.stage === 'failed' || updateStatus.error) {
      toast.error(
        updateStatus.message ??
          updateStatus.error ??
          'העדכון נכשל. בדוק לוגים בשרת (logs/self-update.log או /tmp).',
      );
      setManualUpdateBlock(MANUAL_UPDATE_ONE_LINER);
      return;
    }
    if (updateStatus.stage === 'stale') {
      toast.message(
        updateStatus.message ?? 'סטטוס העדכון לא ברור — בדוק ידנית את השרת.',
      );
      return;
    }
    if (updateStatus.stage === 'done') {
      toast.success(updateStatus.message ?? 'העדכון הושלם.');
      window.setTimeout(() => {
        window.location.reload();
      }, 4000);
    }
  }, [updateStatus, isUpdating]);

  const { data: currentVersion, refetch: refetchCurrent } = useQuery({
    queryKey: ['current-version'],
    queryFn: fetchCurrentVersion,
    staleTime: Infinity,
  });

  const {
    data: checkResult,
    refetch: refetchLatest,
    isFetching: latestFetching,
    error: latestError,
    isError: latestIsError,
  } = useQuery({
    queryKey: ['latest-release'],
    queryFn: fetchLatestRelease,
    staleTime: 5 * 60 * 1000,
    enabled: false,
    retry: false,
  });

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      await Promise.all([refetchCurrent(), refetchLatest()]);
    } finally {
      setIsChecking(false);
    }
  };

  const latestRelease = checkResult?.release ?? null;
  const infoHe = checkResult?.infoHe;
  const errorHe = latestIsError ? formatQueryError(latestError) : null;

  const comparison =
    latestRelease && currentVersion
      ? compareVersions(currentVersion, latestRelease.tag_name)
      : null;

  const hasUpdate = comparison === 1;
  const isUpToDate = comparison === 0;
  const isNewer = comparison === -1;
  const busy = isChecking || latestFetching || performUpdateMutation.isPending;
  const checked = checkResult !== undefined || latestIsError;
  const savingToken = saveTokenMutation.isPending || clearTokenMutation.isPending;

  return (
    <div className="finance-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Github className="h-5 w-5" />
          <h3 className="font-medium">בדיקת עדכונים</h3>
          {tokenConfigured ? (
            <Badge variant="secondary" className="text-xs">
              מוגדר
            </Badge>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={checkForUpdates}
          disabled={busy || isUpdating}
        >
          <RefreshCw className={cn('me-2 h-4 w-4', busy && 'animate-spin')} />
          בדוק עדכונים
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <Label htmlFor="github-release-token" className="text-sm font-medium">
          טוקן GitHub (למאגר פרטי)
        </Label>
        <div className="relative">
          <Input
            id="github-release-token"
            type={showToken ? 'text' : 'password'}
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder={tokenConfigured ? 'הזן טוקן חדש כדי להחליף' : 'ghp_… או fine-grained token'}
            dir="ltr"
            autoComplete="off"
            className="pe-10 text-start font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showToken ? 'הסתר טוקן' : 'הצג טוקן'}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={savingToken || !tokenDraft.trim()}
            onClick={() => saveTokenMutation.mutate(tokenDraft.trim())}
          >
            {saveTokenMutation.isPending ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : null}
            שמור טוקן
          </Button>
          {tokenConfigured ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingToken}
              onClick={() => clearTokenMutation.mutate()}
            >
              {clearTokenMutation.isPending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              הסר טוקן
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          הטוקן נשמר מוצפן בשרת ונבדק מול GitHub לפני השמירה.
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-border py-2">
        <span className="text-muted-foreground">גרסה מותקנת:</span>
        <Badge variant="secondary" className="font-mono">
          v{currentVersion ?? '...'}
        </Badge>
      </div>

      {errorHe ? (
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{errorHe}</p>
        </div>
      ) : null}

      {latestRelease ? (
        <div className="flex items-center justify-between border-b border-border py-2">
          <span className="text-muted-foreground">גרסה אחרונה ב-GitHub:</span>
          <Badge
            variant={hasUpdate ? 'default' : 'secondary'}
            className={cn('font-mono', hasUpdate && 'bg-income text-white hover:bg-income/90')}
          >
            {latestRelease.tag_name}
          </Badge>
        </div>
      ) : null}

      {checked && !errorHe && !latestRelease && infoHe ? (
        <div className="rounded-lg bg-muted/50 p-3 text-center text-sm text-muted-foreground">
          {infoHe}
        </div>
      ) : null}

      {manualUpdateBlock ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
            עדכון ידני (מההוסט / LXC)
          </p>
          <pre
            className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-background p-2 font-mono text-xs"
            dir="ltr"
          >
            {manualUpdateBlock}
          </pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(manualUpdateBlock);
                toast.success('הטקסט הועתק');
              }}
            >
              העתק הוראות
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setManualUpdateBlock(null)}
            >
              סגור
            </Button>
          </div>
        </div>
      ) : null}

      {isUpdating && updateStatus?.inProgress ? (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-primary">מעדכן את המערכת...</p>
              <p className="text-sm text-muted-foreground">
                {updateStatus.message ?? 'מתבצע עדכון ברקע'}
              </p>
            </div>
          </div>
          {typeof updateStatus.progress === 'number' ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, updateStatus.progress))}%` }}
              />
            </div>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            הבנייה וההפעלה מחדש עשויים לקחת מספר דקות; לוג על ההוסט:{' '}
            <span className="font-mono">logs/self-update.log</span> תחת תיקיית האפליקציה.
          </p>
        </div>
      ) : null}

      {comparison !== null ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg p-3',
            hasUpdate && 'bg-income/10 text-income',
            isUpToDate && 'bg-muted text-muted-foreground',
            isNewer && 'bg-primary/10 text-primary',
          )}
        >
          {hasUpdate ? (
            <>
              <Download className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">עדכון זמין!</p>
                <p className="text-sm opacity-80">
                  גרסה {latestRelease?.tag_name} זמינה להורדה
                </p>
              </div>
            </>
          ) : null}
          {isUpToDate ? (
            <>
              <CheckCircle className="h-5 w-5 shrink-0" />
              <p>המערכת מעודכנת לגרסה האחרונה</p>
            </>
          ) : null}
          {isNewer ? (
            <>
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>הגרסה המותקנת חדשה יותר מה-release האחרון</p>
            </>
          ) : null}
        </div>
      ) : null}

      {hasUpdate && latestRelease ? (
        <div className="space-y-3">
          {latestRelease.body ? (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-sm font-medium">מה חדש:</p>
              <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
                {latestRelease.body}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  className="min-w-0 flex-1 bg-income text-white hover:bg-income/90"
                  disabled={isUpdating}
                >
                  <Rocket className="me-2 h-4 w-4 shrink-0" />
                  עדכן אוטומטית
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle>עדכון המערכת מהשרת</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2 text-start">
                    <p>
                      תופעל פקודת עדכון על השרת (git + docker compose). גרסת יעד:{' '}
                      <span className="font-mono">{latestRelease.tag_name}</span>
                    </p>
                    <ul className="list-inside list-disc text-sm">
                      <li>נדרש ש-SELF_UPDATE_ENABLED=true בשרת</li>
                      <li>התהליך עלול לקחת מספר דקות</li>
                      <li>במהלך העדכון השירות עלול להיות לא זמין לרגעים</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse sm:justify-start">
                  <AlertDialogAction
                    type="button"
                    className="bg-income text-white hover:bg-income/90"
                    onClick={() => performUpdateMutation.mutate()}
                  >
                    <Rocket className="me-2 h-4 w-4" />
                    התחל עדכון
                  </AlertDialogAction>
                  <AlertDialogCancel type="button">ביטול</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => window.open(latestRelease.html_url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="me-2 h-4 w-4" />
              צפה ב-GitHub
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-3">
            <p className="mb-2 text-xs text-muted-foreground">או ידנית על השרת:</p>
            <code
              className="block rounded border border-border bg-background p-2 font-mono text-xs"
              dir="ltr"
            >
              cd /opt/finance-app &amp;&amp; git pull &amp;&amp; docker compose build &amp;&amp;
              docker compose up -d
            </code>
          </div>
        </div>
      ) : null}

      {!checked && !busy ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          לחץ &quot;בדוק עדכונים&quot; לבדיקת גרסאות ב-GitHub (באמצעות השרת)
        </p>
      ) : null}
    </div>
  );
}
