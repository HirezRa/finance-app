import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api, { settingsApi } from '@/services/api';
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
  const [tokenDraft, setTokenDraft] = useState('');
  const [showToken, setShowToken] = useState(false);

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
  const busy = isChecking || latestFetching;
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
        <Button type="button" variant="outline" size="sm" onClick={checkForUpdates} disabled={busy}>
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

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(latestRelease.html_url, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="me-2 h-4 w-4" />
              צפה ב-GitHub
            </Button>
          </div>

          <div className="rounded-lg bg-muted p-3">
            <p className="mb-2 text-xs text-muted-foreground">להתקנת העדכון, הרץ על השרת:</p>
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
