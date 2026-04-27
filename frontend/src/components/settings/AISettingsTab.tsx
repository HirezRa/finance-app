import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Cloud,
  Server,
  Check,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Power,
  ExternalLink,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  settingsApi,
  llmApi,
  type LLMProviderType,
  type LLMEngineId,
} from '@/services/api';
import { cn } from '@/lib/utils';
import { cleanOpenRouterModelId } from '@/lib/openrouter-model';

type ConnectionState = 'unknown' | 'connected' | 'error';

interface LlmSavedShape {
  provider: LLMProviderType;
  ollama: { enabled: boolean; url: string; model: string };
  openrouter: {
    model: string;
    apiKeyHint: string | null;
    configured: boolean;
  };
}

export function AISettingsTab() {
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] =
    useState<LLMProviderType>('none');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:7b');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionState>('unknown');
  const [testingProvider, setTestingProvider] = useState<LLMEngineId | null>(
    null,
  );

  const { data: saved, isLoading: loadingSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: () =>
      settingsApi.getLlm().then((res) => res.data as LlmSavedShape),
  });

  const runTestFromSaved = useCallback(
    async (
      provider: LLMEngineId,
      snapshot: LlmSavedShape,
      showToast: boolean,
    ) => {
      try {
        setTestingProvider(provider);
        const body =
          provider === 'openrouter'
            ? { model: snapshot.openrouter.model || undefined }
            : {
                url: snapshot.ollama.url || undefined,
                model: snapshot.ollama.model || undefined,
              };
        const data = await llmApi.test(provider, body);
        setConnectionStatus(data.connected ? 'connected' : 'error');
        if (showToast) {
          if (data.connected) {
            toast.success(
              provider === 'ollama'
                ? 'Ollama מחובר בהצלחה'
                : 'OpenRouter מחובר בהצלחה',
            );
          } else {
            toast.error('החיבור נכשל');
          }
        }
      } catch {
        setConnectionStatus('error');
        if (showToast) {
          toast.error('שגיאה בבדיקת החיבור');
        }
      } finally {
        setTestingProvider(null);
      }
    },
    [],
  );

  const testConnection = useCallback(
    async (provider: LLMEngineId, showToast = true) => {
      try {
        setTestingProvider(provider);
        const body =
          provider === 'openrouter'
            ? {
                apiKey: openrouterApiKey.trim() || undefined,
                model: openrouterModel || undefined,
              }
            : {
                url: ollamaUrl || undefined,
                model: ollamaModel || undefined,
              };
        const data = await llmApi.test(provider, body);
        setConnectionStatus(data.connected ? 'connected' : 'error');
        if (showToast) {
          if (data.connected) {
            toast.success(
              provider === 'ollama'
                ? 'Ollama מחובר בהצלחה'
                : 'OpenRouter מחובר בהצלחה',
            );
          } else {
            toast.error('החיבור נכשל');
          }
        }
      } catch {
        setConnectionStatus('error');
        if (showToast) {
          toast.error('שגיאה בבדיקת החיבור');
        }
      } finally {
        setTestingProvider(null);
      }
    },
    [openrouterApiKey, openrouterModel, ollamaUrl, ollamaModel],
  );

  useEffect(() => {
    if (!saved) return;

    setSelectedProvider(saved.provider ?? 'none');
    setOllamaUrl(saved.ollama.url ?? '');
    setOllamaModel(saved.ollama.model ?? 'qwen2.5:7b');
    setOpenrouterModel(saved.openrouter.model ?? '');
    setOpenrouterApiKey('');
    setHasExistingApiKey(saved.openrouter.configured);

    const p = saved.provider ?? 'none';
    if (p === 'none') {
      setConnectionStatus('unknown');
      return;
    }

    void runTestFromSaved(p, saved, false);
  }, [saved, runTestFromSaved]);

  const handleProviderChange = (provider: LLMProviderType) => {
    setSelectedProvider(provider);
    setConnectionStatus('unknown');
  };

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      settingsApi.updateLlm(body),
    onSuccess: () => {
      toast.success('הגדרות AI נשמרו בהצלחה');
      setOpenrouterApiKey('');
      void queryClient.invalidateQueries({ queryKey: ['llm-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['llm-status'] });
      void queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['ollama-settings'] });
    },
    onError: () => toast.error('שגיאה בשמירת הגדרות'),
  });

  const saveSettings = () => {
    const body: Record<string, unknown> = {
      provider: selectedProvider,
      ollamaUrl,
      ollamaModel,
      openrouterModel: cleanOpenRouterModelId(openrouterModel),
    };
    if (openrouterApiKey.trim()) {
      body.openrouterApiKey = openrouterApiKey.trim();
    }
    saveMutation.mutate(body);
  };

  if (loadingSettings && !saved) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">בחירת מנוע AI</h3>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          בחרו מנוע סיווג אחד בלבד, או כבו את הסיווג האוטומטי
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => handleProviderChange('none')}
            className={cn(
              'rounded-xl border-2 p-4 text-start transition-all',
              selectedProvider === 'none'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">כבוי</span>
              </div>
              {selectedProvider === 'none' ? (
                <Check className="h-5 w-5 text-primary" />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">ללא סיווג אוטומטי</p>
          </button>

          <button
            type="button"
            onClick={() => handleProviderChange('ollama')}
            className={cn(
              'rounded-xl border-2 p-4 text-start transition-all',
              selectedProvider === 'ollama'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Ollama</span>
              </div>
              {selectedProvider === 'ollama' ? (
                <Check className="h-5 w-5 text-primary" />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              מנוע מקומי — ללא עלות
            </p>
            {selectedProvider === 'ollama' &&
            connectionStatus !== 'unknown' ? (
              <div className="mt-2 flex items-center gap-1 text-xs">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    connectionStatus === 'connected'
                      ? 'bg-green-500'
                      : 'bg-red-500',
                  )}
                />
                <span
                  className={
                    connectionStatus === 'connected'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {connectionStatus === 'connected' ? 'מחובר' : 'לא מחובר'}
                </span>
              </div>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => handleProviderChange('openrouter')}
            className={cn(
              'rounded-xl border-2 p-4 text-start transition-all',
              selectedProvider === 'openrouter'
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:border-primary/50',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-blue-500" />
                <span className="font-medium">OpenRouter</span>
              </div>
              {selectedProvider === 'openrouter' ? (
                <Check className="h-5 w-5 text-primary" />
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">גישה למודלים בענן</p>
            {selectedProvider === 'openrouter' &&
            connectionStatus !== 'unknown' ? (
              <div className="mt-2 flex items-center gap-1 text-xs">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    connectionStatus === 'connected'
                      ? 'bg-green-500'
                      : 'bg-red-500',
                  )}
                />
                <span
                  className={
                    connectionStatus === 'connected'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }
                >
                  {connectionStatus === 'connected' ? 'מחובר' : 'לא מחובר'}
                </span>
              </div>
            ) : null}
          </button>
        </div>
      </Card>

      {selectedProvider === 'ollama' ? (
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">הגדרות Ollama</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testConnection('ollama')}
              disabled={testingProvider === 'ollama'}
            >
              {testingProvider === 'ollama' ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="me-2 h-4 w-4" />
              )}
              בדוק חיבור
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="ollamaUrl">כתובת שרת</Label>
              <Input
                id="ollamaUrl"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://192.168.1.186:11434"
                dir="ltr"
                className="mt-1 font-mono text-sm"
              />
            </div>

            <div>
              <Label htmlFor="ollamaModel">מודל</Label>
              <Input
                id="ollamaModel"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="qwen2.5:7b"
                dir="ltr"
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                הזן שם מודל שמותקן ב-Ollama (למשל: qwen2.5:7b, llama3.2:3b)
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {selectedProvider === 'openrouter' ? (
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">הגדרות OpenRouter</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => testConnection('openrouter')}
              disabled={
                testingProvider === 'openrouter' ||
                (!hasExistingApiKey && !openrouterApiKey.trim())
              }
            >
              {testingProvider === 'openrouter' ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="me-2 h-4 w-4" />
              )}
              בדוק חיבור
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="openrouterApiKey">מפתח API</Label>
              <div className="relative mt-1">
                <Input
                  id="openrouterApiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={openrouterApiKey}
                  onChange={(e) => setOpenrouterApiKey(e.target.value)}
                  placeholder={
                    hasExistingApiKey
                      ? 'הזן מפתח חדש להחלפה'
                      : 'sk-or-v1-...'
                  }
                  dir="ltr"
                  className="pe-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showApiKey ? 'הסתר' : 'הצג'}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                קבל מפתח מ-{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>

            <div>
              <Label htmlFor="openrouterModel">מזהה מודל</Label>
              <Input
                id="openrouterModel"
                value={openrouterModel}
                onChange={(e) => setOpenrouterModel(e.target.value)}
                placeholder="google/gemma-3-27b-it:free"
                dir="ltr"
                className="mt-1 font-mono text-sm"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  העתק מזהה מודל מהאתר (כולל :free למודלים חינמיים)
                </p>
                <a
                  href="https://openrouter.ai/models?q=free"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  בחר מודל
                </a>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-2 text-xs font-medium">
                דוגמאות למודלים חינמיים (לחיצה ממלאת את השדה):
              </p>
              <div className="space-y-1">
                {[
                  'google/gemma-3-27b-it:free',
                  'meta-llama/llama-3.3-70b-instruct:free',
                  'mistralai/mistral-small-3.1-24b-instruct:free',
                  'qwen/qwen3-32b:free',
                ].map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setOpenrouterModel(model)}
                    className="block w-full text-start font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={saveSettings}
          disabled={saveMutation.isPending}
          size="lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : null}
          שמור הגדרות
        </Button>
      </div>
    </div>
  );
}
