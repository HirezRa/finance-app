import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  settingsApi,
  llmApi,
  type LLMStatus,
  type LLMProviderType,
  type LLMModel,
} from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  Cloud,
  Server,
  Check,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AISettingsTab() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] =
    useState<LLMProviderType>('ollama');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:7b');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [openrouterModel, setOpenrouterModel] = useState(
    'anthropic/claude-3.5-sonnet',
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<LLMModel[]>([]);
  const [openrouterModels, setOpenrouterModels] = useState<LLMModel[]>([]);

  const { data: llmStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['llm-status'],
    queryFn: () => llmApi.getStatus() as Promise<LLMStatus>,
  });

  const { data: saved } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: () =>
      settingsApi.getLlm().then(
        (res) =>
          res.data as {
            provider: LLMProviderType;
            ollama: { url: string; model: string; enabled: boolean };
            openrouter: {
              model: string;
              configured: boolean;
              apiKeyHint: string | null;
            };
          },
      ),
  });

  useEffect(() => {
    if (saved) {
      setSelectedProvider(saved.provider);
      setOllamaUrl(saved.ollama.url || '');
      setOllamaModel(saved.ollama.model || 'qwen2.5:7b');
      setOpenrouterModel(
        saved.openrouter.model || 'anthropic/claude-3.5-sonnet',
      );
      setOpenrouterApiKey('');
    }
  }, [saved]);

  useEffect(() => {
    if (llmStatus?.providers.ollama?.availableModels?.length) {
      setOllamaModels(llmStatus.providers.ollama.availableModels);
    }
    if (llmStatus?.providers.openrouter?.availableModels?.length) {
      setOpenrouterModels(llmStatus.providers.openrouter.availableModels);
    }
  }, [llmStatus]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      settingsApi.updateLlm(body),
    onSuccess: () => {
      toast.success('הגדרות AI נשמרו');
      void queryClient.invalidateQueries({ queryKey: ['llm-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['llm-status'] });
      void queryClient.invalidateQueries({ queryKey: ['user-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['ollama-settings'] });
    },
    onError: () => toast.error('שגיאה בשמירת הגדרות'),
  });

  const testMutation = useMutation({
    mutationFn: async ({
      provider,
      extra,
    }: {
      provider: LLMProviderType;
      extra?: { apiKey?: string; url?: string; model?: string };
    }) => llmApi.test(provider, extra),
    onSuccess: (data, { provider }) => {
      if (data.connected) {
        toast.success(
          provider === 'ollama' ? 'Ollama מחובר' : 'OpenRouter מחובר',
        );
        void queryClient.invalidateQueries({ queryKey: ['llm-status'] });
        void llmApi.getModels(provider).then((r) => {
          if (provider === 'ollama') setOllamaModels(r.models);
          else setOpenrouterModels(r.models);
        });
      } else {
        toast.error('החיבור נכשל');
      }
    },
    onError: () => toast.error('שגיאה בבדיקת החיבור'),
  });

  const loading = statusLoading && !llmStatus;

  const ollamaSt = llmStatus?.providers.ollama;
  const openrouterSt = llmStatus?.providers.openrouter;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI
          </CardTitle>
          <CardDescription>
            בחרו מנוע סיווג אחד: Ollama מקומי או OpenRouter בענן
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedProvider('ollama')}
                  className={cn(
                    'rounded-xl border-2 p-4 text-start transition-all',
                    selectedProvider === 'ollama'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <Server className="h-5 w-5 text-orange-500" />
                      Ollama
                    </div>
                    {selectedProvider === 'ollama' ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : null}
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    מנוע מקומי — ללא עלות שימוש
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        ollamaSt?.connected ? 'bg-green-500' : 'bg-red-500',
                      )}
                    />
                    <span
                      className={
                        ollamaSt?.connected
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {ollamaSt?.connected ? 'מחובר' : 'לא מחובר'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProvider('openrouter')}
                  className={cn(
                    'rounded-xl border-2 p-4 text-start transition-all',
                    selectedProvider === 'openrouter'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <Cloud className="h-5 w-5 text-sky-500" />
                      OpenRouter
                    </div>
                    {selectedProvider === 'openrouter' ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : null}
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    גישה למודלים בענן (תמחור לפי OpenRouter)
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        openrouterSt?.connected
                          ? 'bg-green-500'
                          : openrouterSt?.error === 'מפתח API לא הוגדר'
                            ? 'bg-amber-500'
                            : 'bg-red-500',
                      )}
                    />
                    <span
                      className={
                        openrouterSt?.connected
                          ? 'text-green-600 dark:text-green-400'
                          : openrouterSt?.error === 'מפתח API לא הוגדר'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {openrouterSt?.connected
                        ? 'מחובר'
                        : openrouterSt?.error === 'מפתח API לא הוגדר'
                          ? 'נדרש מפתח API'
                          : 'לא מחובר'}
                    </span>
                  </div>
                </button>
              </div>

              {selectedProvider === 'ollama' ? (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-medium">
                      <Server className="h-4 w-4 text-orange-500" />
                      הגדרות Ollama
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={testMutation.isPending}
                      onClick={() =>
                        testMutation.mutate({
                          provider: 'ollama',
                          extra: { url: ollamaUrl, model: ollamaModel },
                        })
                      }
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="ms-2 h-4 w-4" />
                      )}
                      בדוק חיבור
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ollama-url">כתובת שרת</Label>
                    <Input
                      id="ollama-url"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      placeholder="http://192.168.1.186:11434"
                      dir="ltr"
                      className="text-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>מודל</Label>
                    <Select
                      value={ollamaModel}
                      onValueChange={setOllamaModel}
                    >
                      <SelectTrigger dir="ltr" className="text-start">
                        <SelectValue placeholder="בחר מודל" />
                      </SelectTrigger>
                      <SelectContent>
                        {ollamaModels.length > 0 ? (
                          ollamaModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={ollamaModel}>
                            {ollamaModel}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-medium">
                      <Cloud className="h-4 w-4 text-sky-500" />
                      הגדרות OpenRouter
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        testMutation.isPending ||
                        (!openrouterApiKey.trim() &&
                          !saved?.openrouter.configured)
                      }
                      onClick={() =>
                        testMutation.mutate({
                          provider: 'openrouter',
                          extra: {
                            apiKey: openrouterApiKey.trim() || undefined,
                            model: openrouterModel,
                          },
                        })
                      }
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="ms-2 h-4 w-4" />
                      )}
                      בדוק חיבור
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="or-key">מפתח API</Label>
                    <div className="relative">
                      <Input
                        id="or-key"
                        type={showApiKey ? 'text' : 'password'}
                        value={openrouterApiKey}
                        onChange={(e) => setOpenrouterApiKey(e.target.value)}
                        placeholder={
                          saved?.openrouter.configured &&
                          saved.openrouter.apiKeyHint
                            ? `שמור (${saved.openrouter.apiKeyHint}) — הזן מפתח חדש להחלפה`
                            : 'sk-or-v1-...'
                        }
                        dir="ltr"
                        className="ps-10 text-start"
                      />
                      <button
                        type="button"
                        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? 'הסתר' : 'הצג'}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        openrouter.ai/keys
                      </a>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>מודל</Label>
                    <Select
                      value={openrouterModel}
                      onValueChange={setOpenrouterModel}
                    >
                      <SelectTrigger dir="ltr" className="text-start">
                        <SelectValue placeholder="בחר מודל" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {openrouterModels.length > 0 ? (
                          openrouterModels.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="anthropic/claude-3.5-sonnet">
                              Claude 3.5 Sonnet
                            </SelectItem>
                            <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="google/gemini-2.0-flash-001">
                              Gemini 2.0 Flash
                            </SelectItem>
                            <SelectItem value="meta-llama/llama-3.3-70b-instruct">
                              Llama 3.3 70B
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const body: Record<string, unknown> = {
                      provider: selectedProvider,
                      ollamaUrl,
                      ollamaModel,
                      openrouterModel,
                    };
                    if (openrouterApiKey.trim()) {
                      body.openrouterApiKey = openrouterApiKey.trim();
                    }
                    saveMutation.mutate(body);
                  }}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="ms-2 h-4 w-4 animate-spin" />
                  ) : null}
                  שמור הגדרות
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
