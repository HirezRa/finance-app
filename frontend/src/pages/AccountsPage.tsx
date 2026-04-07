import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountsApi, scraperApi } from '@/services/api';
import { SyncProgress, type SyncProgressStatus } from '@/components/SyncProgress';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { getAccountDisplayName } from '@/lib/accountDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  RefreshCw,
  Building2,
  CreditCard,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';

interface Account {
  id: string;
  institutionId: string;
  institutionName: string;
  accountNumber: string;
  accountType: 'BANK' | 'CREDIT_CARD';
  nickname?: string;
  description?: string | null;
  balance?: number | string;
  lastSyncAt?: string;
  isActive: boolean;
}

interface ScraperConfig {
  id: string;
  companyId: string;
  companyDisplayName: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastError?: string;
}

interface Institution {
  id: string;
  name: string;
  type: 'bank' | 'card';
  fields: string[];
}

function accBalance(a: Account): number {
  const b = a.balance;
  return typeof b === 'number' ? b : Number(b ?? 0);
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedInstitution, setSelectedInstitution] =
    useState<Institution | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncUi, setSyncUi] = useState<{
    open: boolean;
    status: SyncProgressStatus;
    progress: number;
    message: string;
    details: string;
  }>({
    open: false,
    status: 'idle',
    progress: 0,
    message: '',
    details: '',
  });
  const syncAllTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const { data: accounts, isPending: accountsPending } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll().then((res) => res.data),
  });

  const { data: configs, isPending: configsPending } = useQuery({
    queryKey: ['scraperConfigs'],
    queryFn: () => scraperApi.getConfigs().then((res) => res.data),
  });

  const { data: institutions } = useQuery({
    queryKey: ['institutions'],
    queryFn: () => scraperApi.getInstitutions().then((res) => res.data),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data: {
      companyId: string;
      companyDisplayName: string;
      credentials: Record<string, string>;
    }) => scraperApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraperConfigs'] });
      setShowAddModal(false);
      setSelectedInstitution(null);
      setCredentials({});
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { nickname?: string | null; description?: string | null };
    }) => accountsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setEditingAccount(null);
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id: string) => scraperApi.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraperConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });

  const runProgressTicks = () => {
    let p = 18;
    return window.setInterval(() => {
      p = Math.min(p + 10, 85);
      setSyncUi((s) => (s.status === 'syncing' ? { ...s, progress: p } : s));
    }, 550);
  };

  const invalidateAfterSync = async () => {
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['scraperConfigs'] });
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleConfigSync = async (configId: string) => {
    setSyncingId(configId);
    setSyncUi({
      open: true,
      status: 'syncing',
      progress: 12,
      message: 'מתחבר לבנק…',
      details: '',
    });
    const tick = runProgressTicks();
    try {
      const res = await scraperApi.sync(configId);
      window.clearInterval(tick);
      const data = res.data as { message?: string };
      setSyncUi({
        open: true,
        status: 'success',
        progress: 100,
        message: 'הבקשה נקלטה',
        details: data?.message ?? 'הסנכרון רץ ברקע. הנתונים יתעדכנו בקרוב.',
      });
      await invalidateAfterSync();
    } catch (err: unknown) {
      window.clearInterval(tick);
      const ax = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      let msg: string = ax.message ?? 'אירעה שגיאה לא צפויה';
      const m = ax.response?.data?.message;
      if (Array.isArray(m)) msg = m.join(', ');
      else if (typeof m === 'string') msg = m;
      setSyncUi({
        open: true,
        status: 'error',
        progress: 0,
        message: 'שגיאה בסנכרון',
        details: msg,
      });
    } finally {
      setSyncingId(null);
    }
  };

  const syncAllMutation = useMutation({
    mutationFn: () => scraperApi.syncAll(),
    onMutate: () => {
      if (syncAllTickRef.current) window.clearInterval(syncAllTickRef.current);
      setSyncUi({
        open: true,
        status: 'syncing',
        progress: 15,
        message: 'מתחיל סנכרון לכל החשבונות…',
        details: '',
      });
      syncAllTickRef.current = runProgressTicks();
    },
    onSettled: () => {
      if (syncAllTickRef.current) {
        window.clearInterval(syncAllTickRef.current);
        syncAllTickRef.current = null;
      }
    },
    onSuccess: async (res) => {
      const data = res.data as { message?: string };
      setSyncUi({
        open: true,
        status: 'success',
        progress: 100,
        message: 'הבקשות נקלטו',
        details: data?.message ?? 'הסנכרונים רצים ברקע.',
      });
      await invalidateAfterSync();
    },
    onError: (err: unknown) => {
      const ax = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      let msg: string = ax.message ?? 'אירעה שגיאה';
      const m = ax.response?.data?.message;
      if (Array.isArray(m)) msg = m.join(', ');
      else if (typeof m === 'string') msg = m;
      setSyncUi({
        open: true,
        status: 'error',
        progress: 0,
        message: 'שגיאה בסנכרון הכל',
        details: msg,
      });
    },
  });

  const handleAddConfig = () => {
    if (!selectedInstitution) return;
    createConfigMutation.mutate({
      companyId: selectedInstitution.id,
      companyDisplayName: selectedInstitution.name,
      credentials,
    });
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const fieldLabels: Record<string, string> = {
    userCode: 'קוד משתמש',
    username: 'שם משתמש',
    password: 'סיסמה',
    id: 'תעודת זהות',
    card6Digits: '6 ספרות אחרונות',
    num: 'מספר חשבון',
    nationalID: 'תעודת זהות',
    email: 'אימייל',
    phoneNumber: 'טלפון',
    otpCode: 'קוד SMS',
    otpCodeRetriever: 'שליפת קוד OTP',
    otpLongTermToken: 'טוקן ארוך טווח',
  };

  return (
    <div className="space-y-6">
      <SyncProgress
        isOpen={syncUi.open}
        onClose={() => setSyncUi((s) => ({ ...s, open: false, status: 'idle' }))}
        status={syncUi.status}
        progress={syncUi.progress}
        message={syncUi.message}
        details={syncUi.details}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">חשבונות</h1>
          <p className="text-muted-foreground">
            ניהול חשבונות בנק וכרטיסי אשראי
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="ms-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ms-2 h-4 w-4" />
            )}
            סנכרן הכל
          </Button>
          <Button type="button" onClick={() => setShowAddModal(true)}>
            <Plus className="ms-2 h-4 w-4" />
            הוסף חשבון
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configsPending ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))
        ) : !configs?.length ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">לא הוגדרו חשבונות</p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="ms-2 h-4 w-4" />
                הוסף חשבון ראשון
              </Button>
            </CardContent>
          </Card>
        ) : (
          configs.map((config: ScraperConfig) => {
            const configAccounts =
              accounts?.filter((a: Account) => a.institutionId === config.companyId) ??
              [];
            const totalBalance = configAccounts.reduce(
              (sum: number, a: Account) => sum + accBalance(a),
              0,
            );

            return (
              <Card key={config.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {config.companyDisplayName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {getStatusIcon(config.lastSyncStatus)}
                      {config.lastSyncAt
                        ? `עודכן ${formatDate(config.lastSyncAt)}`
                        : 'טרם סונכרן'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleConfigSync(config.id)}
                      disabled={syncingId === config.id}
                    >
                      {syncingId === config.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('למחוק את החשבון?')) {
                          deleteConfigMutation.mutate(config.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {config.lastError ? (
                    <p className="mb-2 text-sm text-destructive">
                      {config.lastError}
                    </p>
                  ) : null}
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalBalance || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {configAccounts.length} חשבונות
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {accounts && accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>כל החשבונות</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {accountsPending ? (
              <div className="divide-y p-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="divide-y">
                {accounts.map((account: Account) => {
                  const balNum = Number(account.balance) || 0;
                  return (
                    <div key={account.id} className="flex items-center gap-4 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {account.accountType === 'CREDIT_CARD' ? (
                          <CreditCard className="h-5 w-5" />
                        ) : (
                          <Building2 className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {getAccountDisplayName(account)}
                        </p>
                        {account.nickname?.trim() ? (
                          <p className="text-sm text-muted-foreground">
                            {account.institutionName}
                          </p>
                        ) : null}
                        {account.description?.trim() ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {account.description}
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground tabular-nums" dir="ltr">
                          {account.accountNumber}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingAccount(account)}
                        title="עריכת חשבון"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <div className="text-end">
                        <p
                          className={cn(
                            'font-semibold tabular-nums',
                            balNum >= 0 ? 'text-green-500' : 'text-red-500',
                          )}
                        >
                          {formatCurrency(balNum)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!editingAccount}
        onOpenChange={(open) => {
          if (!open) setEditingAccount(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>עריכת חשבון</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? `${editingAccount.institutionName} — ${editingAccount.accountNumber}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {editingAccount ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="acc-nickname">כינוי</Label>
                <Input
                  id="acc-nickname"
                  value={editingAccount.nickname ?? ''}
                  onChange={(e) =>
                    setEditingAccount({
                      ...editingAccount,
                      nickname: e.target.value,
                    })
                  }
                  placeholder="לדוגמה: חשבון משותף, חשבון עסקי..."
                />
                <p className="text-xs text-muted-foreground">יוצג במקום שם הבנק ברוב המסכים</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-desc">תיאור</Label>
                <Textarea
                  id="acc-desc"
                  value={editingAccount.description ?? ''}
                  onChange={(e) =>
                    setEditingAccount({
                      ...editingAccount,
                      description: e.target.value,
                    })
                  }
                  placeholder="הערות נוספות על החשבון..."
                  className="min-h-20"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              disabled={updateAccountMutation.isPending || !editingAccount}
              onClick={() => {
                if (!editingAccount) return;
                updateAccountMutation.mutate({
                  id: editingAccount.id,
                  data: {
                    nickname: editingAccount.nickname?.trim() || null,
                    description: editingAccount.description?.trim() || null,
                  },
                });
              }}
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="m-4 w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {selectedInstitution ? selectedInstitution.name : 'הוסף חשבון'}
              </CardTitle>
              <CardDescription>
                {selectedInstitution
                  ? 'הכנס את פרטי ההתחברות'
                  : 'בחר את הבנק או חברת האשראי'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedInstitution ? (
                <div className="grid max-h-96 gap-2 overflow-y-auto">
                  {institutions?.map((inst: Institution) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => setSelectedInstitution(inst)}
                      className="flex items-center gap-3 rounded-lg border p-3 text-end transition-colors hover:bg-muted"
                    >
                      {inst.type === 'card' ? (
                        <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      {inst.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedInstitution.fields.map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-sm font-medium">
                        {fieldLabels[field] || field}
                      </label>
                      <div className="relative">
                        <Input
                          type={
                            field.toLowerCase().includes('password') && !showPassword
                              ? 'password'
                              : 'text'
                          }
                          value={credentials[field] || ''}
                          onChange={(e) =>
                            setCredentials({
                              ...credentials,
                              [field]: e.target.value,
                            })
                          }
                          dir="ltr"
                          className={
                            field.toLowerCase().includes('password')
                              ? 'pe-10 text-start'
                              : 'text-start'
                          }
                        />
                        {field.toLowerCase().includes('password') ? (
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="flex flex-wrap gap-2 p-6 pt-0">
              {selectedInstitution ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedInstitution(null);
                    setCredentials({});
                  }}
                >
                  חזרה
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedInstitution(null);
                  setCredentials({});
                }}
              >
                ביטול
              </Button>
              {selectedInstitution ? (
                <Button
                  type="button"
                  className="min-w-0 flex-1"
                  onClick={handleAddConfig}
                  disabled={
                    createConfigMutation.isPending ||
                    !selectedInstitution.fields.every((f) => credentials[f])
                  }
                >
                  {createConfigMutation.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : null}
                  הוסף
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
