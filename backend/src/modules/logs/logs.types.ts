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

/** Log schema version stored in meta for forward compatibility (older JSONL lines have no field). */
export const LOG_SCHEMA_VERSION = 2;

export type ProviderType = 'bank' | 'credit_card' | 'other';

export type SyncStage =
  | 'sync_start'
  | 'sync_end'
  | 'sync_fail'
  | 'provider_start'
  | 'provider_end'
  | 'provider_fail'
  | 'account_start'
  | 'account_end'
  | 'account_fail'
  | 'step_start'
  | 'step_success'
  | 'step_fail';

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

export type SyncTerminalMessage =
  | 'sync_start'
  | 'sync_end'
  | 'sync_fail'
  | 'provider_start'
  | 'provider_end'
  | 'provider_fail'
  | 'account_start'
  | 'account_end'
  | 'account_fail'
  | 'step_start'
  | 'step_success'
  | 'step_fail';

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
  /** e.g. github:owner/repo#tag or semver from package.json */
  scraperPackageVersion: string;
  scraperPackageSource?: string;
  scraperGitSha?: string;
  nodeVersion: string;
  nodeEnv: string;
  browserEngine?: string;
  browserVersion?: string;
  osPlatform: string;
  /** OCI digest or image id if provided (e.g. CONTAINER_IMAGE_DIGEST) */
  containerImageDigest?: string;
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
  /** Masked last digits — human scan */
  accountRef?: string;
  /** Stable hash for correlation without reversible account numbers */
  accountRefHash?: string;
  queueName?: string;
  requestId?: string;
  traceparent?: string;
}

export interface SyncLifecycleEventMeta {
  schemaVersion?: number;
  stage: SyncStage;
  status: SyncStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  attempt: number;
  retryCount: number;
  maxRetries?: number;
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
    maxRetries?: number;
    jobTimeoutMs?: number;
  };
  runtime?: SyncRuntimeInfo;
}

export interface SyncFailureMeta {
  errorKind: ErrorKind;
  /** Short stage label, e.g. open_from_date_picker, persist_transactions */
  errorStage: string;
  isRetryable: boolean;
  errorCode?: string;
  /** Short human-facing message (stable / UI); distinct from errorFull when stack exists */
  errorMessage: string;
  /** Full scraper/runtime message (no duplicate of errorMessage when identical) */
  errorFull?: string;
  /** Optional upstream hint (e.g. scraper stage / cause chain) */
  errorCause?: string;
  errorFingerprint: string;
  /** 5–15 lines */
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
