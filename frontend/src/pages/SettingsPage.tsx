import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  settingsApi,
  authApi,
  transactionsApi,
  categoriesApi,
  logsApi,
  type AppLogLevel,
  type AppLogCategory,
} from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
  User,
  Shield,
  Bell,
  Bot,
  Webhook,
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Tags,
  PieChart,
  Palette,
  Moon,
  Sun,
  Monitor,
  ScrollText,
  Download,
} from 'lucide-react';
import type { AuthUser } from '@/store/auth.store';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency, cn } from '@/lib/utils';
import { FontSizeSelector } from '@/components/FontSizeSelector';
import { VersionChecker } from '@/components/VersionChecker';
import { UpdateSection } from '@/components/settings/UpdateSection';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AISettingsTab } from '@/components/settings/AISettingsTab';
import { PageHeader } from '@/components/layout/PageHeader';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'security'
    | 'notifications'
    | 'display'
    | 'budget'
    | 'ai'
    | 'n8n'
    | 'logs'
    | 'data'
  >('profile');

  const tabs = [
    { id: 'profile' as const, label: '×¤×¨×•×¤×™×œ', icon: User },
    { id: 'security' as const, label: '××‘×˜×—×”', icon: Shield },
    { id: 'notifications' as const, label: '×”×ª×¨××•×ª', icon: Bell },
    { id: 'display' as const, label: '×ª×¦×•×’×”', icon: Palette },
    { id: 'budget' as const, label: '×ª×§×¦×™×‘', icon: PieChart },
    { id: 'ai' as const, label: 'AI', icon: Bot },
    { id: 'n8n' as const, label: 'n8n', icon: Webhook },
    { id: 'logs' as const, label: '×œ×•×’×™×', icon: ScrollText },
    { id: 'data' as const, label: '× ×ª×•× ×™×', icon: Trash2 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="×”×’×“×¨×•×ª" subtitle="× ×™×”×•×œ ×”×—×©×‘×•×Ÿ ×•×”××™× ×˜×’×¨×¦×™×•×ª" />

      <div className="sticky top-[73px] z-10 -mx-4 flex flex-wrap gap-2 border-b border-white/10 bg-slate-900/95 px-4 pb-2 pt-2 backdrop-blur-lg md:-mx-6 md:px-6">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="ms-2 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'profile' ? <ProfileSettings /> : null}
      {activeTab === 'security' ? <SecuritySettings /> : null}
      {activeTab === 'notifications' ? <NotificationSettings /> : null}
      {activeTab === 'display' ? <DisplaySettings /> : null}
      {activeTab === 'budget' ? <BudgetSettings /> : null}
      {activeTab === 'ai' ? <AISettingsTab /> : null}
      {activeTab === 'n8n' ? <N8nSettings /> : null}
      {activeTab === 'logs' ? <LogsSettings /> : null}
      {activeTab === 'data' ? <DataSettings /> : null}
    </div>
  );
}

function DisplaySettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Palette className="h-5 w-5" />
        ×”×’×“×¨×•×ª ×ª×¦×•×’×”
      </h2>

      <div className="finance-card space-y-4">
        <h3 className="font-medium">×¢×¨×›×ª × ×•×©×</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
              theme === 'light'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm font-medium">×‘×”×™×¨</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all',
              theme === 'dark'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm font-medium">×›×”×”</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all sm:col-span-1',
              theme === 'system'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
            )}
          >
            <Monitor className="h-6 w-6" />
            <span className="text-sm font-medium">×ž×¢×¨×›×ª</span>
          </button>
        </div>
      </div>

      <div className="finance-card">
        <FontSizeSelector />
      </div>

      <div className="border-t border-border pt-4">
        <VersionChecker />
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Download className="h-5 w-5" />
          ×¢×“×›×•× ×™ ×ž×¢×¨×›×ª
        </h3>
        <UpdateSection />
      </div>
    </div>
  );
}

const LOG_LEVELS: AppLogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const LOG_CATEGORIES: AppLogCategory[] = [
  'sync',
  'account',
  'auth',
  'scraper',
  'ollama',
  'openrouter',
  'system',
  'api',
  'webhook',
  'categorization',
  'version',
];

const CATEGORY_LABELS: Record<AppLogCategory, string> = {
  sync: '×¡× ×›×¨×•×Ÿ',
  account: '×—×©×‘×•× ×•×ª',
  auth: '××™×ž×•×ª',
  scraper: '×¡×§×¨×™×™×¤×¨',
  ollama: 'OLLAMA',
  openrouter: 'OpenRouter',
  system: '×ž×¢×¨×›×ª',
  api: 'API',
  webhook: 'Webhooks',
  categorization: '×¡×™×•×•×’',
  version: '×’×¨×¡××•×ª',
};

function logLevelClass(level: AppLogLevel): string {
  switch (level) {
    case 'DEBUG':
      return 'text-slate-500 dark:text-slate-400';
    case 'INFO':
      return 'text-sky-600 dark:text-sky-400';
    case 'WARN':
      return 'text-amber-600 dark:text-amber-400';
    case 'ERROR':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

function LogsSettings() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<string>('__all__');
  const [category, setCategory] = useState<string>('__all__');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const {
    data: logs,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['app-logs', level, category, debouncedQ],
    queryFn: () =>
      logsApi
        .get({
          level: level === '__all__' ? undefined : (level as AppLogLevel),
          category:
            category === '__all__' ? undefined : (category as AppLogCategory),
          q: debouncedQ.trim() || undefined,
          limit: 1000,
        })
        .then((res) => res.data.logs),
    refetchInterval: autoRefresh ? 4000 : false,
  });

  const clearMutation = useMutation({
    mutationFn: () => logsApi.clear(),
    onSuccess: (res) => {
      toast.success(res.data.messageHe ?? '×”×œ×•×’×™× × ×•×§×•');
      void queryClient.invalidateQueries({ queryKey: ['app-logs'] });
    },
    onError: () => toast.error('×©×’×™××” ×‘× ×™×§×•×™ ×”×œ×•×’×™×'),
  });

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs ?? [], null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-app-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('×”×§×•×‘×¥ ×”×•×¨×“');
  };

  const errMsg =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: string }).message === 'string'
      ? (error as { message: string }).message
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          ×™×•×ž×Ÿ ×ž×¢×¨×›×ª
        </CardTitle>
        <CardDescription>
          ×¡× ×›×¨×•×Ÿ, ×©×’×™××•×ª ×•×¤×¢×™×œ×•×ª â€” ×¢×“ 1000 ×¨×©×•×ž×•×ª ××—×¨×•× ×•×ª
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>×¨×ž×ª ×œ×•×’</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="×”×›×œ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">×”×›×œ</SelectItem>
                  {LOG_LEVELS.map((lv) => (
                    <SelectItem key={lv} value={lv}>
                      {lv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>×§×˜×’×•×¨×™×”</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="×”×›×œ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">×”×›×œ</SelectItem>
                  {LOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logs-search">×—×™×¤×•×©</Label>
              <Input
                id="logs-search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="×˜×§×¡×˜ ×‘×”×•×“×¢×” ××• ×‘Ö¾meta..."
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <Switch
                id="logs-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="logs-auto-refresh" className="cursor-pointer text-sm">
                ×¨×¢× ×•×Ÿ ××•×˜×•×ž×˜×™ (4 ×©× ×³)
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : null}
              ×¨×¢× ×Ÿ
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportLogs}
              disabled={!logs?.length}
            >
              <Download className="ms-2 h-4 w-4" />
              ×™×™×¦×•× JSON
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={clearMutation.isPending}
                >
                  <Trash2 className="ms-2 h-4 w-4" />
                  × ×§×” ×œ×•×’×™×
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>×œ×ž×—×•×§ ××ª ×›×œ ×”×œ×•×’×™×?</AlertDialogTitle>
                  <AlertDialogDescription>
                    ×”×¤×¢×•×œ×” ×ª×ž×—×§ ××ª ×™×•×ž×Ÿ ×”××™×¨×•×¢×™× ×”×©×ž×•×¨ ×‘×©×¨×ª. ×œ× × ×™×ª×Ÿ ×œ×©×—×–×¨ ×¨×©×•×ž×•×ª
                    ×©× ×ž×—×§×•.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>×‘×™×˜×•×œ</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => clearMutation.mutate()}
                  >
                    × ×§×”
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {errMsg ? (
          <p className="text-sm text-red-500" dir="ltr">
            {errMsg}
          </p>
        ) : null}

        <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              ×˜×•×¢×Ÿâ€¦
            </div>
          ) : !logs?.length ? (
            <p className="text-muted-foreground">××™×Ÿ ×¨×©×•×ž×•×ª ×œ×”×¦×’×”</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded border border-border/60 bg-background/80 px-2 py-1.5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[10px] text-muted-foreground" dir="ltr">
                      {entry.ts}
                    </span>
                    <span className={cn('font-semibold', logLevelClass(entry.level))}>
                      {entry.level}
                    </span>
                    <span className="text-violet-600 dark:text-violet-400">
                      {CATEGORY_LABELS[entry.category] ?? entry.category}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{entry.message}</p>
                  {entry.meta && Object.keys(entry.meta).length > 0 ? (
                    <pre
                      className="mt-1 max-h-24 overflow-auto rounded bg-muted/50 p-1 text-[10px] opacity-90"
                      dir="ltr"
                    >
                      {JSON.stringify(entry.meta, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DataSettings() {
  const queryClient = useQueryClient();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const createDefaultCategoriesMutation = useMutation({
    mutationFn: () => categoriesApi.createDefaults(),
    onSuccess: (response) => {
      const { created, skipped } = response.data;
      toast.success(
        `× ×•×¦×¨×• ${created} ×§×˜×’×•×¨×™×•×ª ×—×“×©×•×ª${skipped > 0 ? `, ${skipped} ×›×‘×¨ ×§×™×™×ž×•×ª` : ''}`,
      );
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => {
      toast.error('×©×’×™××” ×‘×™×¦×™×¨×ª ×§×˜×’×•×¨×™×•×ª');
    },
  });

  const deleteAllTransactionsMutation = useMutation({
    mutationFn: async () => {
      console.log('=== DELETE ALL MUTATION STARTED ===');
      const storeToken = useAuthStore.getState().accessToken;
      console.log('Token in store:', !!storeToken);
      try {
        const raw = localStorage.getItem('finance-auth');
        const parsed = raw
          ? (JSON.parse(raw) as { state?: { accessToken?: string | null } })
          : null;
        console.log('Token in persisted finance-auth:', !!parsed?.state?.accessToken);
      } catch {
        console.log('Token in persisted finance-auth: (parse error)');
      }
      const response = await transactionsApi.deleteAll();
      console.log('=== DELETE ALL RESPONSE ===', response);
      return response;
    },
    onSuccess: (response) => {
      const deleted = response.data?.deleted ?? 0;
      console.log('=== DELETE SUCCESS ===', response.data);
      toast.success(`× ×ž×—×§×• ${deleted} ×¢×¡×§××•×ª ×‘×”×¦×œ×—×”`);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setDeleteConfirmText('');
    },
    onError: (error: unknown) => {
      console.error('=== DELETE ERROR ===', error);
      const ax = error as {
        message?: string;
        response?: { data?: unknown; status?: number };
      };
      console.error('Response status:', ax.response?.status);
      console.error('Response body:', ax.response?.data);
      const detail =
        ax.response?.data &&
        typeof ax.response.data === 'object' &&
        'message' in ax.response.data &&
        typeof (ax.response.data as { message: unknown }).message === 'string'
          ? (ax.response.data as { message: string }).message
          : typeof ax.message === 'string'
            ? ax.message
            : null;
      toast.error(
        detail ? `×©×’×™××” ×‘×ž×—×™×§×ª ×”×¢×¡×§××•×ª: ${detail}` : '×©×’×™××” ×‘×ž×—×™×§×ª ×”×¢×¡×§××•×ª',
      );
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>× ×™×”×•×œ × ×ª×•× ×™×</CardTitle>
        <CardDescription>×™×¦×™×¨×” ×•×ž×—×™×§×” ×©×œ × ×ª×•× ×™× ×‘×ž×¢×¨×›×ª</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-blue-500">
                <Tags className="h-4 w-4" />
                ×™×¦×™×¨×ª ×§×˜×’×•×¨×™×•×ª ×‘×¡×™×¡
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                ×™×•×¦×¨ ×›Ö¾30 ×§×˜×’×•×¨×™×•×ª ×‘×¡×™×¡×™×•×ª ×¢× ×ž×™×œ×•×ª ×ž×¤×ª×— ×œ×¡×™×•×•×’ ××•×˜×•×ž×˜×™. ×§×˜×’×•×¨×™×•×ª
                ×§×™×™×ž×•×ª (×›×•×œ×œ ×ž×¢×¨×›×ª) ×œ× ×™×•×©×¤×¢×•.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => createDefaultCategoriesMutation.mutate()}
              disabled={createDefaultCategoriesMutation.isPending}
              className="shrink-0 border-blue-500 text-blue-500 hover:bg-blue-500/10"
            >
              {createDefaultCategoriesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '×¦×•×¨ ×§×˜×’×•×¨×™×•×ª'
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-medium text-red-500">×ž×—×™×§×ª ×›×œ ×”×¢×¡×§××•×ª</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                ×¤×¢×•×œ×” ×–×• ×ª×ž×—×§ ××ª ×›×œ ×”×¢×¡×§××•×ª ×ž×›×œ ×”×—×©×‘×•× ×•×ª. ×”×¤×¢×•×œ×” ×‘×œ×ª×™ ×”×¤×™×›×”!
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="ms-2 h-4 w-4" />
                  ×ž×—×§ ×”×›×œ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-500">
                    âš ï¸ ××–×”×¨×”: ×ž×—×™×§×ª ×›×œ ×”×¢×¡×§××•×ª
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-4">
                    <p>
                      ××ª×” ×¢×•×ž×“ ×œ×ž×—×•×§ ××ª <strong>×›×œ ×”×¢×¡×§××•×ª</strong> ×ž×‘×¡×™×¡ ×”× ×ª×•× ×™×.
                    </p>
                    <p>
                      ×¤×¢×•×œ×” ×–×• <strong>×‘×œ×ª×™ ×”×¤×™×›×”</strong> ×•×œ× × ×™×ª×Ÿ ×œ×©×—×–×¨ ××ª ×”× ×ª×•× ×™×.
                    </p>
                    <p className="font-medium">×œ×”×ž×©×š, ×”×§×œ×“ "×ž×—×§ ×”×›×œ" ×‘×©×“×” ×œ×ž×˜×”:</p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder='×”×§×œ×“ "×ž×—×§ ×”×›×œ"'
                      className="mt-2"
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                    ×‘×™×˜×•×œ
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllTransactionsMutation.mutate()}
                    disabled={
                      deleteConfirmText !== '×ž×—×§ ×”×›×œ' ||
                      deleteAllTransactionsMutation.isPending
                    }
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deleteAllTransactionsMutation.isPending
                      ? '×ž×•×—×§...'
                      : '××™×©×•×¨ ×ž×—×™×§×”'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileInactiveAccountsToggle() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () =>
      settingsApi.get().then((res) => res.data as { showInactiveAccounts?: boolean }),
  });
  const updateMutation = useMutation({
    mutationFn: (checked: boolean) =>
      settingsApi.update({ showInactiveAccounts: checked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('×”×”×’×“×¨×” × ×©×ž×¨×”');
    },
    onError: () => toast.error('×©×’×™××” ×‘×©×ž×™×¨×”'),
  });
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="settings-show-inactive-accounts">×”×¦×’ ×—×©×‘×•× ×•×ª ×œ× ×¤×¢×™×œ×™×</Label>
        <p className="text-xs text-muted-foreground">
          ×›×¨×˜×™×¡×™× ×•×—×©×‘×•× ×•×ª ×©×¡×•×ž× ×• ×›×œ× ×¤×¢×™×œ×™× ×™×•×¤×™×¢×• ×‘×“×£ ×”×—×©×‘×•× ×•×ª (×‘×¨×™×¨×ª ×ž×—×“×œ: ×ž×•×¡×ª×¨×™×)
        </p>
      </div>
      <Switch
        id="settings-show-inactive-accounts"
        checked={settings?.showInactiveAccounts === true}
        onCheckedChange={(c) => updateMutation.mutate(c)}
        disabled={updateMutation.isPending}
      />
    </div>
  );
}

function ProfileSettings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user?.name ?? '');

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => settingsApi.getProfile().then((res) => res.data),
  });

  useEffect(() => {
    if (profile?.name != null) {
      setName(profile.name);
    }
  }, [profile?.name]);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => settingsApi.updateProfile(data),
    onSuccess: (res) => {
      const u = res.data as AuthUser;
      if (user) {
        setUser({
          ...user,
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>×¤×¨×•×¤×™×œ</CardTitle>
        <CardDescription>×¤×¨×˜×™ ×”×—×©×‘×•×Ÿ ×©×œ×š</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">×©×</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="×”×©× ×©×œ×š"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">××™×ž×™×™×œ</label>
          <Input value={profile?.email ?? ''} disabled dir="ltr" className="text-start" />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{profile?._count?.accounts ?? 0} ×—×©×‘×•× ×•×ª</span>
          <span>â€¢</span>
          <span>{profile?._count?.categories ?? 0} ×§×˜×’×•×¨×™×•×ª</span>
        </div>
        <ProfileInactiveAccountsToggle />
        <Button
          type="button"
          onClick={() => updateMutation.mutate({ name })}
          disabled={updateMutation.isPending || name === (profile?.name ?? user?.name)}
        >
          {updateMutation.isPending ? (
            <Loader2 className="ms-2 h-4 w-4 animate-spin" />
          ) : null}
          ×©×ž×•×¨ ×©×™× ×•×™×™×
        </Button>
      </CardContent>
    </Card>
  );
}

function SecuritySettings() {
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const { data: status, refetch } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => authApi.get2FAStatus().then((res) => res.data),
  });

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (res) => {
      setSetupData(res.data);
      setShowSetup(true);
    },
  });

  const enableMutation = useMutation({
    mutationFn: (data: { secret: string; token: string }) =>
      authApi.enable2FA(data),
    onSuccess: (res) => {
      const codes = (res.data as { recoveryCodes?: string[] }).recoveryCodes ?? [];
      setRecoveryCodes(codes);
      setShowSetup(false);
      setSetupData(null);
      setToken('');
      void refetch();
    },
  });

  const disableMutation = useMutation({
    mutationFn: (data: { password: string }) => authApi.disable2FA(data),
    onSuccess: () => {
      setPassword('');
      void refetch();
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>××™×ž×•×ª ×“×•-×©×œ×‘×™ (2FA)</CardTitle>
        <CardDescription>×”×•×¡×£ ×©×›×‘×ª ××‘×˜×—×” × ×•×¡×¤×ª ×œ×—×©×‘×•×Ÿ ×©×œ×š</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              status?.enabled ? 'bg-green-500/20 text-green-500' : 'bg-muted'
            }`}
          >
            {status?.enabled ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{status?.enabled ? '×ž×•×¤×¢×œ' : '×œ× ×ž×•×¤×¢×œ'}</p>
            {status?.enabled && status?.remainingRecoveryCodes !== undefined ? (
              <p className="text-sm text-muted-foreground">
                {status.remainingRecoveryCodes} ×§×•×“×™ ×©×—×–×•×¨ × ×•×ª×¨×•
              </p>
            ) : null}
          </div>
        </div>

        {!status?.enabled && !showSetup ? (
          <Button
            type="button"
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
          >
            {setupMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : null}
            ×”×¤×¢×œ 2FA
          </Button>
        ) : null}

        {showSetup && setupData ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex justify-center">
              <img src={setupData.qrCode} alt="QR Code" className="h-48 w-48" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              ×¡×¨×•×§ ××ª ×”×§×•×“ ×‘××¤×œ×™×§×¦×™×™×ª ×”××™×ž×•×ª ×©×œ×š
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">××• ×”×›× ×¡ ×™×“× ×™×ª:</label>
              <div className="flex gap-2">
                <Input
                  value={setupData.secret}
                  readOnly
                  dir="ltr"
                  className="font-mono text-start"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void navigator.clipboard.writeText(setupData.secret)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">×§×•×“ ××™×ž×•×ª:</label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="000000"
                maxLength={6}
                dir="ltr"
                className="text-center"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  enableMutation.mutate({ secret: setupData.secret, token })
                }
                disabled={enableMutation.isPending || token.length !== 6}
              >
                {enableMutation.isPending ? (
                  <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                ) : null}
                ××ž×ª ×•×”×¤×¢×œ
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowSetup(false)}>
                ×‘×™×˜×•×œ
              </Button>
            </div>
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <p className="font-medium text-yellow-500">×©×ž×•×¨ ××ª ×§×•×“×™ ×”×©×—×–×•×¨!</p>
            <p className="text-sm text-muted-foreground">
              ×§×•×“×™× ××œ×• ×™××¤×©×¨×• ×œ×š ×œ×”×ª×—×‘×¨ ×× ×ª××‘×“ ×’×™×©×” ×œ××¤×œ×™×§×¦×™×™×ª ×”××™×ž×•×ª
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="rounded bg-muted px-2 py-1">
                  {code}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}
            >
              <Copy className="ms-2 h-4 w-4" />
              ×”×¢×ª×§ ×”×›×œ
            </Button>
          </div>
        ) : null}

        {status?.enabled ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium text-destructive">×›×™×‘×•×™ 2FA</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="×”×›× ×¡ ×¡×™×¡×ž×” ×œ××™×ž×•×ª"
              dir="ltr"
              className="text-start"
            />
            <Button
              type="button"
              variant="destructive"
              onClick={() => disableMutation.mutate({ password })}
              disabled={disableMutation.isPending || !password}
            >
              {disableMutation.isPending ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : null}
              ×›×‘×” 2FA
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NotificationSettings() {
  const queryClient = useQueryClient();
  const [threshold, setThreshold] = useState('500');
  const [salaryStartDay, setSalaryStartDay] = useState(25);
  const [salaryEndDay, setSalaryEndDay] = useState(31);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => settingsApi.get().then((res) => res.data),
  });

  useEffect(() => {
    if (settings?.largeExpenseThreshold != null) {
      setThreshold(Number(settings.largeExpenseThreshold).toString());
    }
    if (settings?.salaryStartDay != null) {
      setSalaryStartDay(Number(settings.salaryStartDay));
    }
    if (settings?.salaryEndDay != null) {
      setSalaryEndDay(Number(settings.salaryEndDay));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>×”×’×“×¨×•×ª ×”×ª×¨××•×ª</CardTitle>
        <CardDescription>×”×’×“×¨ ×ž×ª×™ ×œ×§×‘×œ ×”×ª×¨××•×ª</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">×¡×£ ×”×•×¦××” ×’×“×•×œ×” (â‚ª)</label>
          <div className="flex flex-wrap gap-2">
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="500"
              className="w-32"
              dir="ltr"
            />
            <Button
              type="button"
              onClick={() =>
                updateMutation.mutate({ largeExpenseThreshold: Number(threshold) })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : null}
              ×©×ž×•×¨
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ×ª×§×‘×œ ×”×ª×¨××” ×¢×œ ×›×œ ×”×•×¦××” ×ž×¢×œ ×¡×›×•× ×–×”
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">×”×ª×¨××•×ª ×ª×§×¦×™×‘</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.budgetWarningEnabled !== false}
                onChange={(e) =>
                  updateMutation.mutate({ budgetWarningEnabled: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">×”×ª×¨××” ×‘-80% ×ž×”×ª×§×¦×™×‘</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.budgetExceededEnabled !== false}
                onChange={(e) =>
                  updateMutation.mutate({ budgetExceededEnabled: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-sm">×”×ª×¨××” ×¢×œ ×—×¨×™×’×” ×ž×ª×§×¦×™×‘</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium">×”×’×“×¨×•×ª ×ž×©×›×•×¨×ª</h3>
          <p className="text-sm text-muted-foreground">
            ×”×›× ×¡×•×ª ×©×ž×¡×•×•×’×•×ª ×›&ldquo;×”×›× ×¡×”&rdquo; ×©× ×›× ×¡×•×ª ×‘×™×Ÿ ×”×™×ž×™× ×©× ×‘×—×¨×• (×œ×¤×™ ×œ×•×— ×™×©×¨××œ×™)
            ×™×™×—×©×‘×• ×‘×“×©×‘×•×¨×“ ×•×‘×ª×§×¦×™×‘ ×œ×—×•×“×© ×”×¢×•×§×‘ (×ª××¨×™×š ××¤×§×˜×™×‘×™ = ×”-1 ×œ×—×•×“×© ×”×‘×).
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">×ž×™×•×</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={salaryStartDay}
                onChange={(e) => setSalaryStartDay(Number(e.target.value))}
                className="w-24"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">×¢×“ ×™×•×</label>
              <Input
                type="number"
                min={1}
                max={31}
                value={salaryEndDay}
                onChange={(e) => setSalaryEndDay(Number(e.target.value))}
                className="w-24"
                dir="ltr"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                updateMutation.mutate({
                  salaryStartDay,
                  salaryEndDay,
                })
              }
              disabled={
                updateMutation.isPending ||
                (settings?.salaryStartDay === salaryStartDay &&
                  settings?.salaryEndDay === salaryEndDay)
              }
            >
              {updateMutation.isPending ? (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              ) : null}
              ×©×ž×•×¨ ×˜×•×•×— ×ž×©×›×•×¨×ª
            </Button>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium">×¢×¡×§××•×ª ×‘×ª×”×œ×™×š ×§×œ×™×˜×”</h3>
          <p className="text-sm text-muted-foreground">
            ×¢×¡×§××•×ª ×©×¢×“×™×™×Ÿ ×œ× × ×§×œ×˜×• ×¡×•×¤×™×ª ×‘×—×©×‘×•×Ÿ (×‘×“×¨×š ×›×œ×œ ×œ×¤× ×™ ×—×™×•×‘ ×‘×›×¨×˜×™×¡ ××©×¨××™).
          </p>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">×”×¦×’ ×‘×œ×•×— ×‘×§×¨×”</p>
              <p className="text-xs text-muted-foreground">
                ×›×‘×•×™ = ×¨×§ ×¢×¡×§××•×ª ×¡×•×¤×™×•×ª ×‘×¡×™×›×•×ž×™ ×”×›× ×¡×•×ª ×•×”×•×¦××•×ª
              </p>
            </div>
            <Switch
              checked={settings?.includePendingInDashboard !== false}
              onCheckedChange={(v) =>
                updateMutation.mutate({ includePendingInDashboard: v })
              }
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">×›×œ×•×œ ×‘×ª×§×¦×™×‘</p>
              <p className="text-xs text-muted-foreground">
                ×ž×•×¤×¢×œ = ×’× ×¢×¡×§××•×ª ×‘×ª×”×œ×™×š × ×¡×¤×¨×•×ª ×ž×•×œ ×ª×§×¦×™×‘ ×”×§×˜×’×•×¨×™×•×ª
              </p>
            </div>
            <Switch
              checked={settings?.includePendingInBudget === true}
              onCheckedChange={(v) =>
                updateMutation.mutate({ includePendingInBudget: v })
              }
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                ×”×¡×ª×¨ ×—×™×•×‘×™ ××©×¨××™ ×ž×—×©×‘×•×Ÿ ×‘× ×§
              </Label>
              <p className="text-xs text-muted-foreground">
                ×ž×•× ×¢ ×¡×¤×™×¨×” ×›×¤×•×œ×” ×›×©×™×© ×’× ×—×©×‘×•×Ÿ ×‘× ×§ ×•×’× ×›×¨×˜×™×¡ ××©×¨××™ (×—×™×•×‘ ××’×¨×’×˜×™×‘×™
                ×‘×‘× ×§ ×ž×¡×•×ž×Ÿ ×©×œ× × ×¡×¤×¨ ×‘×ª×§×¦×™×‘)
              </p>
            </div>
            <Switch
              checked={settings?.excludeCreditCardChargesFromBudget !== false}
              onCheckedChange={(v) =>
                updateMutation.mutate({ excludeCreditCardChargesFromBudget: v })
              }
              disabled={updateMutation.isPending}
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            ×›×“×™ ×œ×§×‘×œ ×”×ª×¨××•×ª ×‘-Telegram, WhatsApp ××• ××™×ž×™×™×œ â€” ×”×’×“×¨ webhook ×‘-n8n ×‘×˜××‘ ×”×ž×ª××™×.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function BudgetSettings() {
  const queryClient = useQueryClient();
  const [budgetCycleStartDay, setBudgetCycleStartDay] = useState(1);
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState(0);

  const { data: settings } = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => settingsApi.get().then((res) => res.data),
  });

  useEffect(() => {
    if (settings) {
      setBudgetCycleStartDay(Number(settings.budgetCycleStartDay ?? 1));
      setMonthlySavingsGoal(Number(settings.monthlySavingsGoal ?? 0));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>×”×’×“×¨×•×ª ×ª×§×¦×™×‘</CardTitle>
        <CardDescription>×ž×—×–×•×¨ ×ª×§×¦×™×‘ ×—×•×“×©×™ ×•×™×¢×“ ×—×™×¡×›×•×Ÿ ×—×•×“×©×™</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>×ž×—×–×•×¨ ×ª×§×¦×™×‘ ×—×•×“×©×™</Label>
          <p className="text-sm text-muted-foreground">
            ×‘×—×¨ ×ž×ª×™ ×ž×ª×—×™×œ ×”×—×•×“×© ×”×ª×§×¦×™×‘×™ (×œ×¤×™ ×œ×•×— ×©× ×” ×™×©×¨××œ×™)
          </p>
          <RadioGroup
            value={String(budgetCycleStartDay)}
            onValueChange={(v) => {
              const value = parseInt(v, 10);
              setBudgetCycleStartDay(value);
              updateMutation.mutate({ budgetCycleStartDay: value });
            }}
            className="flex flex-col gap-3"
            disabled={updateMutation.isPending}
          >
            <div className="flex items-center gap-2 space-x-reverse">
              <RadioGroupItem value="1" id="cycle-1" />
              <Label htmlFor="cycle-1" className="cursor-pointer font-normal">
                <span className="font-medium">1 ×‘×—×•×“×©</span>
                <span className="text-muted-foreground ms-2">(×ž×—×–×•×¨ ×§×œ× ×“×¨×™ ×¨×’×™×œ)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2 space-x-reverse">
              <RadioGroupItem value="10" id="cycle-10" />
              <Label htmlFor="cycle-10" className="cursor-pointer font-normal">
                <span className="font-medium">10 ×‘×—×•×“×©</span>
                <span className="text-muted-foreground ms-2">(×ž×ª××™× ×œ×—×™×•×‘ ××©×¨××™)</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="space-y-3">
          <Label>×™×¢×“ ×—×™×¡×›×•×Ÿ ×—×•×“×©×™</Label>
          <p className="text-sm text-muted-foreground">
            ×¡×›×•× ×©×ª×¨×¦×” ×œ×©×ž×•×¨ ×‘×¦×“ ×›×œ ×—×•×“×©. ×”×¡×›×•× ×™×•×¤×—×ª ×ž×™×ª×¨×” ×–×ž×™× ×” ×œ×”×•×¦××•×ª ×‘×œ×•×— ×”×‘×§×¨×”.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={monthlySavingsGoal === 0 ? '' : monthlySavingsGoal}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMonthlySavingsGoal(raw === '' ? 0 : Number(raw));
                }}
                onBlur={() => {
                  updateMutation.mutate({ monthlySavingsGoal });
                }}
                placeholder="0"
                className="ps-8"
                dir="ltr"
              />
              <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                â‚ª
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMonthlySavingsGoal(0);
                updateMutation.mutate({ monthlySavingsGoal: 0 });
              }}
              disabled={updateMutation.isPending}
            >
              ××¤×¡
            </Button>
          </div>

          {monthlySavingsGoal > 0 ? (
            <p className="text-sm text-green-600 dark:text-green-500">
              {formatCurrency(monthlySavingsGoal)} ×™×•×¤×—×ª×• ×ž×”×™×ª×¨×” ×”×–×ž×™× ×” ×œ×”×•×¦××•×ª ×‘×“×©×‘×•×¨×“
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function N8nSettings() {
  const queryClient = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['n8n-settings'],
    queryFn: () => settingsApi.getN8n().then((res) => res.data),
  });

  useEffect(() => {
    if (settings) {
      setWebhookUrl(settings.webhookUrl || '');
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      enabled?: boolean;
      webhookUrl?: string;
      webhookSecret?: string;
    }) => settingsApi.updateN8n(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-settings'] });
      setWebhookSecret('');
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: { url: string; secret?: string }) =>
      settingsApi.testN8n(data),
    onSuccess: (res) => {
      const d = res.data as { success: boolean; message?: string; error?: string };
      setTestResult({
        success: d.success,
        message: d.message || d.error,
      });
    },
    onError: () => {
      setTestResult({ success: false, message: '×©×’×™××ª ×—×™×‘×•×¨' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>n8n Webhooks</CardTitle>
        <CardDescription>×©×œ×™×—×ª ×”×ª×¨××•×ª ×•××™×¨×•×¢×™× ×œ-n8n</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              settings?.enabled ? 'bg-green-500/20 text-green-500' : 'bg-muted'
            }`}
          >
            <Webhook className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{settings?.enabled ? '×ž×•×¤×¢×œ' : '×œ× ×ž×•×¤×¢×œ'}</p>
          </div>
          <Button
            type="button"
            variant={settings?.enabled ? 'destructive' : 'default'}
            onClick={() => updateMutation.mutate({ enabled: !settings?.enabled })}
          >
            {settings?.enabled ? '×›×‘×”' : '×”×¤×¢×œ'}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Webhook URL</label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-n8n.com/webhook/..."
            dir="ltr"
            className="text-start"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Secret (××•×¤×¦×™×•× ×œ×™)</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="×”×–×Ÿ secret ×—×“×© ×œ×©×ž×™×¨×”"
              dir="ltr"
              className="pe-10 text-start"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {testResult ? (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 ${
              testResult.success
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              testMutation.mutate({
                url: webhookUrl,
                secret: webhookSecret || undefined,
              })
            }
            disabled={testMutation.isPending || !webhookUrl}
          >
            {testMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : null}
            ×‘×“×•×§ ×—×™×‘×•×¨
          </Button>
          <Button
            type="button"
            onClick={() =>
              updateMutation.mutate({
                webhookUrl,
                ...(webhookSecret ? { webhookSecret } : {}),
              })
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : null}
            ×©×ž×•×¨
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
