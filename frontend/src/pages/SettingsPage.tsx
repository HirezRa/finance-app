import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, authApi, transactionsApi, categoriesApi } from '@/services/api';
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
  Cpu,
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
} from 'lucide-react';
import type { AuthUser } from '@/store/auth.store';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'notifications' | 'budget' | 'ollama' | 'n8n' | 'data'
  >('profile');

  const tabs = [
    { id: 'profile' as const, label: 'פרופיל', icon: User },
    { id: 'security' as const, label: 'אבטחה', icon: Shield },
    { id: 'notifications' as const, label: 'התראות', icon: Bell },
    { id: 'budget' as const, label: 'תקציב', icon: PieChart },
    { id: 'ollama' as const, label: 'OLLAMA', icon: Cpu },
    { id: 'n8n' as const, label: 'n8n', icon: Webhook },
    { id: 'data' as const, label: 'נתונים', icon: Trash2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted-foreground">ניהול החשבון והאינטגרציות</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
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
      {activeTab === 'budget' ? <BudgetSettings /> : null}
      {activeTab === 'ollama' ? <OllamaSettings /> : null}
      {activeTab === 'n8n' ? <N8nSettings /> : null}
      {activeTab === 'data' ? <DataSettings /> : null}
    </div>
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
        `נוצרו ${created} קטגוריות חדשות${skipped > 0 ? `, ${skipped} כבר קיימות` : ''}`,
      );
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => {
      toast.error('שגיאה ביצירת קטגוריות');
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
      toast.success(`נמחקו ${deleted} עסקאות בהצלחה`);
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
        detail ? `שגיאה במחיקת העסקאות: ${detail}` : 'שגיאה במחיקת העסקאות',
      );
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>ניהול נתונים</CardTitle>
        <CardDescription>יצירה ומחיקה של נתונים במערכת</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-blue-500">
                <Tags className="h-4 w-4" />
                יצירת קטגוריות בסיס
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                יוצר כ־30 קטגוריות בסיסיות עם מילות מפתח לסיווג אוטומטי. קטגוריות
                קיימות (כולל מערכת) לא יושפעו.
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
                'צור קטגוריות'
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-medium text-red-500">מחיקת כל העסקאות</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                פעולה זו תמחק את כל העסקאות מכל החשבונות. הפעולה בלתי הפיכה!
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="ms-2 h-4 w-4" />
                  מחק הכל
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-red-500">
                    ⚠️ אזהרה: מחיקת כל העסקאות
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-4">
                    <p>
                      אתה עומד למחוק את <strong>כל העסקאות</strong> מבסיס הנתונים.
                    </p>
                    <p>
                      פעולה זו <strong>בלתי הפיכה</strong> ולא ניתן לשחזר את הנתונים.
                    </p>
                    <p className="font-medium">להמשך, הקלד "מחק הכל" בשדה למטה:</p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder='הקלד "מחק הכל"'
                      className="mt-2"
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                    ביטול
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllTransactionsMutation.mutate()}
                    disabled={
                      deleteConfirmText !== 'מחק הכל' ||
                      deleteAllTransactionsMutation.isPending
                    }
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deleteAllTransactionsMutation.isPending
                      ? 'מוחק...'
                      : 'אישור מחיקה'}
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
      toast.success('ההגדרה נשמרה');
    },
    onError: () => toast.error('שגיאה בשמירה'),
  });
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="settings-show-inactive-accounts">הצג חשבונות לא פעילים</Label>
        <p className="text-xs text-muted-foreground">
          כרטיסים וחשבונות שסומנו כלא פעילים יופיעו בדף החשבונות (ברירת מחדל: מוסתרים)
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
        <CardTitle>פרופיל</CardTitle>
        <CardDescription>פרטי החשבון שלך</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">שם</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="השם שלך"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">אימייל</label>
          <Input value={profile?.email ?? ''} disabled dir="ltr" className="text-start" />
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{profile?._count?.accounts ?? 0} חשבונות</span>
          <span>•</span>
          <span>{profile?._count?.categories ?? 0} קטגוריות</span>
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
          שמור שינויים
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
        <CardTitle>אימות דו-שלבי (2FA)</CardTitle>
        <CardDescription>הוסף שכבת אבטחה נוספת לחשבון שלך</CardDescription>
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
            <p className="font-medium">{status?.enabled ? 'מופעל' : 'לא מופעל'}</p>
            {status?.enabled && status?.remainingRecoveryCodes !== undefined ? (
              <p className="text-sm text-muted-foreground">
                {status.remainingRecoveryCodes} קודי שחזור נותרו
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
            הפעל 2FA
          </Button>
        ) : null}

        {showSetup && setupData ? (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex justify-center">
              <img src={setupData.qrCode} alt="QR Code" className="h-48 w-48" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              סרוק את הקוד באפליקציית האימות שלך
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">או הכנס ידנית:</label>
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
              <label className="text-sm font-medium">קוד אימות:</label>
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
                אמת והפעל
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowSetup(false)}>
                ביטול
              </Button>
            </div>
          </div>
        ) : null}

        {recoveryCodes.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <p className="font-medium text-yellow-500">שמור את קודי השחזור!</p>
            <p className="text-sm text-muted-foreground">
              קודים אלו יאפשרו לך להתחבר אם תאבד גישה לאפליקציית האימות
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
              העתק הכל
            </Button>
          </div>
        ) : null}

        {status?.enabled ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium text-destructive">כיבוי 2FA</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הכנס סיסמה לאימות"
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
              כבה 2FA
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OllamaSettings() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    models?: string[];
  } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['ollama-settings'],
    queryFn: () => settingsApi.getOllama().then((res) => res.data),
  });

  useEffect(() => {
    if (settings) {
      setUrl(settings.url || '');
      setModel(settings.model || 'mistral');
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: { enabled?: boolean; url?: string; model?: string }) =>
      settingsApi.updateOllama(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ollama-settings'] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (data: { url: string; model?: string }) =>
      settingsApi.testOllama(data),
    onSuccess: (res) => {
      const d = res.data as {
        success: boolean;
        error?: string;
        availableModels?: string[];
      };
      setTestResult({
        success: d.success,
        message: d.error,
        models: d.availableModels,
      });
    },
    onError: () => {
      setTestResult({ success: false, message: 'שגיאת חיבור' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>OLLAMA</CardTitle>
        <CardDescription>
          חיבור לשרת OLLAMA לסיווג אוטומטי של עסקאות
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              settings?.enabled ? 'bg-green-500/20 text-green-500' : 'bg-muted'
            }`}
          >
            <Cpu className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{settings?.enabled ? 'מופעל' : 'לא מופעל'}</p>
          </div>
          <Button
            type="button"
            variant={settings?.enabled ? 'destructive' : 'default'}
            onClick={() => updateMutation.mutate({ enabled: !settings?.enabled })}
          >
            {settings?.enabled ? 'כבה' : 'הפעל'}
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">כתובת שרת</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:11434"
            dir="ltr"
            className="text-start"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">מודל</label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="mistral"
            dir="ltr"
            className="text-start"
          />
          {testResult?.models?.length ? (
            <p className="text-xs text-muted-foreground">
              מודלים זמינים: {testResult.models.join(', ')}
            </p>
          ) : null}
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
            <span>{testResult.success ? 'החיבור הצליח' : testResult.message}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => testMutation.mutate({ url, model })}
            disabled={testMutation.isPending || !url}
          >
            {testMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : null}
            בדוק חיבור
          </Button>
          <Button
            type="button"
            onClick={() => updateMutation.mutate({ url, model })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : null}
            שמור
          </Button>
        </div>
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
        <CardTitle>הגדרות התראות</CardTitle>
        <CardDescription>הגדר מתי לקבל התראות</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">סף הוצאה גדולה (₪)</label>
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
              שמור
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            תקבל התראה על כל הוצאה מעל סכום זה
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">התראות תקציב</label>
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
              <span className="text-sm">התראה ב-80% מהתקציב</span>
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
              <span className="text-sm">התראה על חריגה מתקציב</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium">הגדרות משכורת</h3>
          <p className="text-sm text-muted-foreground">
            הכנסות שמסווגות כ&ldquo;הכנסה&rdquo; שנכנסות בין הימים שנבחרו (לפי לוח ישראלי)
            ייחשבו בדשבורד ובתקציב לחודש העוקב (תאריך אפקטיבי = ה-1 לחודש הבא).
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">מיום</label>
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
              <label className="text-sm font-medium">עד יום</label>
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
              שמור טווח משכורת
            </Button>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="font-medium">עסקאות בתהליך קליטה</h3>
          <p className="text-sm text-muted-foreground">
            עסקאות שעדיין לא נקלטו סופית בחשבון (בדרך כלל לפני חיוב בכרטיס אשראי).
          </p>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">הצג בלוח בקרה</p>
              <p className="text-xs text-muted-foreground">
                כבוי = רק עסקאות סופיות בסיכומי הכנסות והוצאות
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
              <p className="text-sm font-medium">כלול בתקציב</p>
              <p className="text-xs text-muted-foreground">
                מופעל = גם עסקאות בתהליך נספרות מול תקציב הקטגוריות
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
                הסתר חיובי אשראי מחשבון בנק
              </Label>
              <p className="text-xs text-muted-foreground">
                מונע ספירה כפולה כשיש גם חשבון בנק וגם כרטיס אשראי (חיוב אגרגטיבי
                בבנק מסומן שלא נספר בתקציב)
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
            כדי לקבל התראות ב-Telegram, WhatsApp או אימייל — הגדר webhook ב-n8n בטאב המתאים.
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
        <CardTitle>הגדרות תקציב</CardTitle>
        <CardDescription>מחזור תקציב חודשי ויעד חיסכון חודשי</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>מחזור תקציב חודשי</Label>
          <p className="text-sm text-muted-foreground">
            בחר מתי מתחיל החודש התקציבי (לפי לוח שנה ישראלי)
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
                <span className="font-medium">1 בחודש</span>
                <span className="text-muted-foreground ms-2">(מחזור קלנדרי רגיל)</span>
              </Label>
            </div>
            <div className="flex items-center gap-2 space-x-reverse">
              <RadioGroupItem value="10" id="cycle-10" />
              <Label htmlFor="cycle-10" className="cursor-pointer font-normal">
                <span className="font-medium">10 בחודש</span>
                <span className="text-muted-foreground ms-2">(מתאים לחיוב אשראי)</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="h-px w-full bg-border" />

        <div className="space-y-3">
          <Label>יעד חיסכון חודשי</Label>
          <p className="text-sm text-muted-foreground">
            סכום שתרצה לשמור בצד כל חודש. הסכום יופחת מיתרה זמינה להוצאות בלוח הבקרה.
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
                ₪
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
              אפס
            </Button>
          </div>

          {monthlySavingsGoal > 0 ? (
            <p className="text-sm text-green-600 dark:text-green-500">
              {formatCurrency(monthlySavingsGoal)} יופחתו מהיתרה הזמינה להוצאות בדשבורד
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
      setTestResult({ success: false, message: 'שגיאת חיבור' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>n8n Webhooks</CardTitle>
        <CardDescription>שליחת התראות ואירועים ל-n8n</CardDescription>
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
            <p className="font-medium">{settings?.enabled ? 'מופעל' : 'לא מופעל'}</p>
          </div>
          <Button
            type="button"
            variant={settings?.enabled ? 'destructive' : 'default'}
            onClick={() => updateMutation.mutate({ enabled: !settings?.enabled })}
          >
            {settings?.enabled ? 'כבה' : 'הפעל'}
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
          <label className="text-sm font-medium">Secret (אופציונלי)</label>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="הזן secret חדש לשמירה"
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
            בדוק חיבור
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
            שמור
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
