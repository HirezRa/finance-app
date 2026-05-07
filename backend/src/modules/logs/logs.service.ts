import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { APP_VERSION } from '../../version';
import type {
  AppLogEntry,
  ErrorKind,
  LogCategory,
  LogLevel,
  ProviderType,
  SyncFailureMeta,
  SyncLifecycleEventMeta,
  SyncRuntimeInfo,
  SyncTerminalMessage,
  SyncTraceContext,
} from './logs.types';
import { LOG_SCHEMA_VERSION } from './logs.types';

const MAX_LOGS = 1000;
const MAX_META_JSON_BYTES = 48 * 1024;

const SENSITIVE_META_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'passwordHash',
  'authorization',
  'encryptedCredentials',
  'credentialsIv',
  'credentialsAuthTag',
]);

const MASKED_TEXT = '***';

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);
  private entries: AppLogEntry[] = [];
  private readonly filePath: string;

  constructor() {
    const dir = join(process.cwd(), 'logs');
    this.filePath = join(dir, 'app-logs.jsonl');
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch {
      /* ignore */
    }
  }

  onModuleInit(): void {
    this.loadFromDisk();
    this.add('INFO', 'system', 'system_boot', {
      nodeEnv: process.env.NODE_ENV ?? 'development',
    });
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) {
      return;
    }
    try {
      const text = readFileSync(this.filePath, 'utf-8');
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const parsed: AppLogEntry[] = [];
      for (const line of lines.slice(-MAX_LOGS)) {
        try {
          parsed.push(JSON.parse(line) as AppLogEntry);
        } catch {
          /* skip bad line */
        }
      }
      this.entries = parsed.slice(-MAX_LOGS);
    } catch (e) {
      this.logger.warn('Failed to load app logs file', e);
    }
  }

  private persistAll(): void {
    try {
      const body =
        this.entries.map((e) => JSON.stringify(e)).join('\n') +
        (this.entries.length > 0 ? '\n' : '');
      writeFileSync(this.filePath, body, 'utf-8');
    } catch (e) {
      this.logger.warn('Failed to persist app logs', e);
    }
  }

  getSyncRuntimeInfo(): SyncRuntimeInfo {
    return {
      appVersion: APP_VERSION,
      scraperPackageVersion: this.getScraperPackageVersion(),
      scraperPackageSource: 'package.json:dependencies.israeli-bank-scrapers',
      scraperGitSha: process.env.SCRAPER_GIT_SHA,
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      browserEngine: 'chromium',
      browserVersion: process.env.CHROMIUM_VERSION,
      osPlatform: `${process.platform}/${process.arch}`,
      containerImageDigest: process.env.CONTAINER_IMAGE_DIGEST,
    };
  }

  parseDatabaseUrlForLog(url: string | undefined): {
    dbHost?: string;
    dbPort?: number;
  } {
    if (!url?.trim()) return {};
    try {
      const u = new URL(url);
      const port = u.port ? parseInt(u.port, 10) : undefined;
      return { dbHost: u.hostname, dbPort: port };
    } catch {
      return {};
    }
  }

  classifyErrorKindFromStrings(errorType: string, errorMessage: string): ErrorKind {
    const msg = `${errorType ?? ''} ${errorMessage ?? ''}`.trim();
    return this.classifyErrorKindFromUnknown(
      msg ? new Error(msg) : new Error(String(errorMessage)),
      errorMessage,
    );
  }

  classifyErrorKindFromUnknown(error: unknown, fallbackMessage: string): ErrorKind {
    const msg = (
      error instanceof Error ? error.message : String(error ?? fallbackMessage)
    ).toLowerCase();
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return 'db_unavailable';
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P1001', 'P1017', 'P1000'].includes(error.code)) return 'db_unavailable';
      return 'db_query_error';
    }
    if (msg.includes('prisma') || msg.includes('database')) {
      if (msg.includes('connect') || msg.includes('timeout') || msg.includes('econn')) {
        return 'db_unavailable';
      }
      return 'db_query_error';
    }
    if (msg.includes('invalid_password') || msg.includes('password')) return 'auth_failed';
    if (msg.includes('otp')) return 'otp_required_or_failed';
    if (msg.includes('mfa') && msg.includes('timeout')) return 'mfa_timeout';
    if (msg.includes('selector') && msg.includes('timeout')) return 'ui_selector_timeout';
    if (msg.includes('not interactable')) return 'ui_element_not_interactable';
    if (msg.includes('navigation') && msg.includes('timeout')) return 'navigation_timeout';
    if (msg.includes('rate limit') || msg.includes('too many requests')) return 'rate_limited';
    if (msg.includes('network') || msg.includes('econn') || msg.includes('enotfound')) {
      return 'network_error';
    }
    if (msg.includes('parse') || msg.includes('unexpected token')) return 'parse_error';
    if (msg.includes('validation')) return 'data_validation_error';
    if (msg.includes('israeli-bank-scrapers') || msg.includes('dependency')) {
      return 'dependency_error';
    }
    return 'unknown';
  }

  prismaErrorCodeFromUnknown(error: unknown): string | undefined {
    if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
    return undefined;
  }

  createSyncTraceContext(input: {
    syncRunId?: string;
    jobId: string;
    configId: string;
    userId: string;
    providerId: string;
    providerType: ProviderType;
    providerName: string;
    accountRef?: string;
    accountRefHash?: string;
    tenantId?: string;
    workspaceId?: string;
    queueName?: string;
    requestId?: string;
    traceparent?: string;
  }): SyncTraceContext {
    return {
      syncRunId: input.syncRunId ?? randomUUID(),
      jobId: input.jobId,
      configId: input.configId,
      userId: input.userId,
      providerId: input.providerId,
      providerType: input.providerType,
      providerName: input.providerName,
      accountRef: input.accountRef,
      accountRefHash: input.accountRefHash,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      queueName: input.queueName,
      requestId: input.requestId,
      traceparent: input.traceparent,
    };
  }

  accountRefHash(
    userId: string,
    providerId: string,
    accountNumber: string,
  ): string {
    const norm = String(accountNumber ?? '').trim();
    return createHash('sha256')
      .update(`${userId}|${providerId}|${norm}`)
      .digest('hex')
      .slice(0, 24);
  }

  maskEmailInString(email: string): string {
    const e = email.trim();
    if (!e.includes('@')) return '***@***';
    const [local, ...rest] = e.split('@');
    const domain = rest.join('@');
    if (!domain) return '***@***';
    const maskedLocal =
      local.length > 2 ? `${local.substring(0, 2)}***` : '***';
    return `${maskedLocal}@${domain}`;
  }

  maskIdentifier(value: string | undefined | null, keepLast = 4): string | undefined {
    if (!value) return undefined;
    const clean = String(value).trim();
    if (!clean) return undefined;
    const suffix = clean.slice(-Math.max(2, keepLast));
    return `***${suffix}`;
  }

  maskUrl(value: string | undefined | null): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return value.split('?')[0];
    }
  }

  buildErrorFingerprint(input: {
    errorKind: ErrorKind;
    errorStage: string;
    providerId?: string;
    code?: string;
    message: string;
    selectorPrimary?: string;
  }): string {
    const sel = (input.selectorPrimary ?? '').trim().slice(0, 120);
    const stable = [
      input.errorKind,
      input.errorStage,
      input.providerId ?? '',
      input.code ?? '',
      input.message.slice(0, 180),
      sel,
    ].join('|');
    return createHash('sha256').update(stable).digest('hex').slice(0, 16);
  }

  private capMetaSize(meta: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...meta };
    let encoded = JSON.stringify(clone);
    if (encoded.length <= MAX_META_JSON_BYTES) {
      return clone;
    }
    delete clone.browserConsoleErrors;
    delete clone.failedNetworkRequests;
    delete clone.fullStack;
    clone.metaTruncated = true;
    encoded = JSON.stringify(clone);
    if (encoded.length <= MAX_META_JSON_BYTES) {
      return clone;
    }
    return {
      schemaVersion: clone.schemaVersion,
      syncRunId: clone.syncRunId,
      jobId: clone.jobId,
      configId: clone.configId,
      userId: clone.userId,
      providerId: clone.providerId,
      message: 'meta_overflow',
      metaTruncated: true,
      originalMetaBytes: encoded.length,
    };
  }

  logSyncLifecycle(
    level: LogLevel,
    message: SyncTerminalMessage,
    trace: SyncTraceContext,
    lifecycle: SyncLifecycleEventMeta,
    extraMeta?: Record<string, unknown>,
  ): void {
    const lifecycleWithSchema: SyncLifecycleEventMeta = {
      ...lifecycle,
      schemaVersion: LOG_SCHEMA_VERSION,
    };
    this.assertCriticalSyncFields(trace, lifecycleWithSchema);
    this.add(level, 'sync', message, {
      ...trace,
      ...lifecycleWithSchema,
      ...extraMeta,
    });
  }

  logSyncFailure(
    eventMessage: 'step_fail' | 'account_fail' | 'provider_fail' | 'sync_fail',
    trace: SyncTraceContext,
    lifecycle: SyncLifecycleEventMeta,
    failure: SyncFailureMeta,
    extraMeta?: Record<string, unknown>,
  ): void {
    const lifecycleWithSchema: SyncLifecycleEventMeta = {
      ...lifecycle,
      schemaVersion: LOG_SCHEMA_VERSION,
    };
    this.assertCriticalSyncFields(trace, lifecycleWithSchema);
    this.assertErrorEventFields(trace, failure, eventMessage);
    const merged = this.capMetaSize({
      ...trace,
      ...lifecycleWithSchema,
      ...failure,
      ...extraMeta,
      runtime:
        eventMessage === 'sync_fail'
          ? this.getSyncRuntimeInfo()
          : (extraMeta?.runtime as SyncRuntimeInfo | undefined) ??
            lifecycleWithSchema.runtime,
    });
    this.add('ERROR', 'sync', eventMessage, merged);
  }

  /**
   * Worker-level terminal failure when ScraperService could not emit sync_fail
   * (e.g. crash before trace, or unexpected throw).
   */
  logUnhandledJobSyncFail(params: {
    syncRunId: string;
    jobId: string;
    configId: string;
    userId: string;
    error: unknown;
    durationMs: number;
    queue?: SyncLifecycleEventMeta['queue'];
    startedAt: Date;
  }): void {
    const message =
      params.error instanceof Error ? params.error.message : String(params.error);
    const short = message.slice(0, 500);
    const errorKind = this.classifyErrorKindFromUnknown(params.error, message);
    const prismaCode = this.prismaErrorCodeFromUnknown(params.error);
    const stack =
      params.error instanceof Error ? params.error.stack : undefined;
    const stackHead = stack?.split('\n').slice(0, 15).join('\n');
    const trace = this.createSyncTraceContext({
      syncRunId: params.syncRunId,
      jobId: params.jobId,
      configId: params.configId,
      userId: params.userId,
      providerId: 'unknown',
      providerType: 'other',
      providerName: 'unknown',
    });
    const endedAt = new Date();
    this.logSyncFailure(
      'sync_fail',
      trace,
      {
        schemaVersion: LOG_SCHEMA_VERSION,
        stage: 'sync_fail',
        status: 'failure',
        startedAt: params.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: params.durationMs,
        attempt: 1,
        retryCount: 0,
        queue: params.queue,
        runtime: this.getSyncRuntimeInfo(),
      },
      {
        errorKind,
        errorStage: 'worker_unhandled',
        isRetryable: true,
        errorCode: prismaCode,
        errorMessage: short,
        errorFingerprint: this.buildErrorFingerprint({
          errorKind,
          errorStage: 'worker_unhandled',
          message: short,
        }),
        stackHead,
        ...(process.env.NODE_ENV === 'development' ? { fullStack: stack } : {}),
      },
      {
        db: {
          ...this.parseDatabaseUrlForLog(process.env.DATABASE_URL),
          prismaErrorCode: prismaCode,
          errorClass:
            params.error instanceof Error ? params.error.name : 'UnknownError',
          reconnectAttempts: 0,
        },
      },
    );
  }

  private assertCriticalSyncFields(
    trace: SyncTraceContext,
    lifecycle: SyncLifecycleEventMeta,
  ): void {
    const requiredTrace = [
      'syncRunId',
      'jobId',
      'configId',
      'userId',
      'providerId',
      'providerType',
      'providerName',
    ] as const;
    const missingTrace = requiredTrace.filter((k) => !trace[k]);
    const requiredLifecycle = ['stage', 'status', 'startedAt', 'endedAt', 'durationMs'] as const;
    const missingLifecycle = requiredLifecycle.filter(
      (k) => lifecycle[k] === undefined || lifecycle[k] === null,
    );
    if (missingTrace.length || missingLifecycle.length) {
      this.logger.warn(
        `Critical sync log missing fields: trace=[${missingTrace.join(',')}], lifecycle=[${missingLifecycle.join(',')}]`,
      );
    }
  }

  private assertErrorEventFields(
    trace: SyncTraceContext,
    failure: SyncFailureMeta,
    eventMessage: string,
  ): void {
    if (!trace.syncRunId || !failure.errorKind || !failure.errorStage) {
      this.logger.warn(
        `Sync ERROR event ${eventMessage} missing syncRunId/errorKind/errorStage`,
      );
    }
  }

  private getScraperPackageVersion(): string {
    try {
      const packageJson = join(process.cwd(), 'package.json');
      if (!existsSync(packageJson)) return 'unknown';
      const pkg = JSON.parse(readFileSync(packageJson, 'utf-8')) as {
        dependencies?: Record<string, string>;
      };
      return pkg.dependencies?.['israeli-bank-scrapers'] ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private sanitizeMeta(
    meta: Record<string, unknown> | undefined,
    depth = 0,
  ): Record<string, unknown> | undefined {
    if (!meta || depth > 8) {
      return meta;
    }
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(meta)) {
      const lower = key.toLowerCase();
      if (key === 'email' && typeof raw === 'string') {
        out[key] = this.maskEmailInString(raw);
        continue;
      }
      if (
        SENSITIVE_META_KEYS.has(key) ||
        lower.includes('password') ||
        lower.includes('otp') ||
        lower.includes('cookie') ||
        lower.includes('token') ||
        lower === 'headers' ||
        lower.includes('authorization') ||
        (lower.includes('secret') && key !== 'message')
      ) {
        out[key] = MASKED_TEXT;
        continue;
      }
      if (key === 'credentials' || key === 'encryptedCredentials') {
        out[key] = '[REDACTED]';
        continue;
      }
      if (typeof raw === 'string' && lower.includes('account') && key !== 'accountRefHash') {
        out[key] = this.maskIdentifier(raw);
        continue;
      }
      if (
        typeof raw === 'string' &&
        (lower.endsWith('url') || lower.includes('url')) &&
        key !== 'accountRefHash'
      ) {
        out[key] = this.maskUrl(raw);
        continue;
      }
      if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
        out[key] = this.sanitizeMeta(raw as Record<string, unknown>, depth + 1) as unknown;
        continue;
      }
      if (Array.isArray(raw)) {
        out[key] = raw.map((item) =>
          item !== null &&
          typeof item === 'object' &&
          !Array.isArray(item)
            ? this.sanitizeMeta(item as Record<string, unknown>, depth + 1)
            : item,
        ) as unknown;
        continue;
      }
      out[key] = raw;
    }
    return out;
  }

  add(
    level: LogLevel,
    category: LogCategory,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const safeMeta = this.sanitizeMeta(meta);
    const entry: AppLogEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      level,
      category,
      message,
      meta: safeMeta,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_LOGS) {
      this.entries = this.entries.slice(-MAX_LOGS);
    }
    this.persistAll();
  }

  query(filters: {
    level?: LogLevel;
    category?: LogCategory;
    q?: string;
    limit?: number;
  }): AppLogEntry[] {
    let list = [...this.entries].reverse();
    if (filters.level) {
      list = list.filter((e) => e.level === filters.level);
    }
    if (filters.category) {
      list = list.filter((e) => e.category === filters.category);
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      list = list.filter((e) => {
        const inMsg = e.message.toLowerCase().includes(q);
        const inMeta =
          e.meta && JSON.stringify(e.meta).toLowerCase().includes(q);
        return inMsg || Boolean(inMeta);
      });
    }
    const lim = Math.min(filters.limit ?? 200, MAX_LOGS);
    return list.slice(0, lim);
  }

  exportTrace(filters: {
    syncRunId?: string;
    providerId?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): { logs: AppLogEntry[]; totalMatched: number } {
    let list = [...this.entries];
    if (filters.syncRunId?.trim()) {
      const id = filters.syncRunId.trim();
      list = list.filter((e) => e.meta && e.meta['syncRunId'] === id);
    }
    if (filters.providerId?.trim()) {
      const pid = filters.providerId.trim();
      list = list.filter((e) => e.meta && e.meta['providerId'] === pid);
    }
    if (filters.from?.trim()) {
      const t0 = new Date(filters.from).getTime();
      list = list.filter((e) => new Date(e.ts).getTime() >= t0);
    }
    if (filters.to?.trim()) {
      const t1 = new Date(filters.to).getTime();
      list = list.filter((e) => new Date(e.ts).getTime() <= t1);
    }
    const totalMatched = list.length;
    const lim = Math.min(filters.limit ?? MAX_LOGS, MAX_LOGS);
    list = list.slice(-lim);
    return { logs: list, totalMatched };
  }

  /** For tests / invariants: true if this in-memory buffer has a terminal sync event for the run. */
  hasTerminalSyncForRun(syncRunId: string): boolean {
    return this.entries.some((e) => {
      if (e.meta?.['syncRunId'] !== syncRunId || e.category !== 'sync') {
        return false;
      }
      return e.message === 'sync_end' || e.message === 'sync_fail';
    });
  }

  clear(): void {
    this.entries = [];
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
    } catch {
      /* ignore */
    }
    this.add('INFO', 'system', 'logs_cleared');
  }

  logUpdate(action: string, details: Record<string, unknown>): void {
    this.add('INFO', 'update', action, {
      ...details,
      timestamp: new Date().toISOString(),
    });
  }

  logExternalService(
    service: 'ollama' | 'openrouter' | 'n8n' | 'github',
    status: 'success' | 'error' | 'timeout' | 'unavailable',
    details: Record<string, unknown>,
  ): void {
    const level = status === 'success' ? 'INFO' : 'ERROR';
    this.add(level, 'external-service', `${service}: ${status}`, {
      service,
      status,
      ...details,
    });
  }

  logScraperIssue(
    bank: string,
    errorType: 'auth' | 'timeout' | 'blocked' | 'parse' | 'network' | 'unknown',
    message: string,
    details?: Record<string, unknown>,
  ): void {
    this.add('ERROR', 'scraper', `${bank}: ${errorType} — ${message}`, {
      bank,
      errorType,
      ...details,
    });
  }

  logScraperSuccess(
    bank: string,
    accountsCount: number,
    transactionsCount: number,
  ): void {
    this.add('INFO', 'scraper', `${bank}: סנכרון הצליח`, {
      bank,
      accountsCount,
      transactionsCount,
    });
  }
}
