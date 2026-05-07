export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogCategory =
  | 'sync'
  | 'account'
  | 'auth'
  | 'scraper'
  | 'ollama'
  | 'openrouter'
  | 'system'
  | 'api'
  | 'webhook'
  | 'categorization'
  | 'version'
  | 'update'
  | 'external-service';

export type ProviderType = 'bank' | 'credit-card' | 'other';

export type SyncStage =
  | 'sync_start'
  | 'provider_start'
  | 'account_start'
  | 'step_start'
  | 'step_success'
  | 'step_fail'
  | 'account_end'
  | 'provider_end'
  | 'sync_end';

export type SyncStep =
  | 'auth_start'
  | 'auth_success'
  | 'post_auth_navigation'
  | 'open_accounts_overview'
  | 'open_account_details'
  | 'apply_filters/date_range'
  | 'fetch_transactions'
  | 'parse_transactions'
  | 'normalize_transactions'
  | 'persist_results';

export type SyncStatus = 'success' | 'failure' | 'partial';

export type ErrorKind =
  | 'auth_failed'
  | 'otp_required_or_failed'
  | 'mfa_timeout'
  | 'ui_selector_timeout'
  | 'ui_element_not_interactable'
  | 'navigation_timeout'
  | 'network_error'
  | 'rate_limited'
  | 'parse_error'
  | 'data_validation_error'
  | 'db_unavailable'
  | 'db_query_error'
  | 'dependency_error'
  | 'unknown';

export interface SyncRuntimeInfo {
  appVersion: string;
  scraperPackageVersion: string;
  scraperGitSha?: string;
  nodeVersion: string;
  nodeEnv: string;
  browserEngine?: string;
  browserVersion?: string;
  osPlatform: string;
}

export interface SyncTraceContext {
  syncRunId: string;
  jobId: string;
  configId: string;
  userId: string;
  tenantId?: string;
  workspaceId?: string;
  providerId: string;
  providerType: ProviderType;
  providerName: string;
  accountRef?: string;
  queueName?: string;
}

export interface SyncLifecycleEventMeta {
  stage: SyncStage;
  status: SyncStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  attempt: number;
  retryCount: number;
  timeoutMs?: number;
  step?: SyncStep;
  transactionsFetched?: number;
  transactionsParsed?: number;
  transactionsPersisted?: number;
  duplicatesSkipped?: number;
  accountsTotal?: number;
  accountsSucceeded?: number;
  accountsFailed?: number;
  dataWindow?: { from: string; to: string };
  partialSync?: boolean;
  queue?: {
    queueName: string;
    enqueueTs?: string;
    dequeueTs?: string;
    waitMs?: number;
    runMs?: number;
  };
  runtime?: SyncRuntimeInfo;
}

export interface SyncFailureMeta {
  errorKind: ErrorKind;
  errorStage: SyncStage | SyncStep;
  isRetryable: boolean;
  errorCode?: string;
  errorMessage: string;
  errorFingerprint: string;
  stackHead?: string;
  fullStack?: string;
}

export interface AppLogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}

