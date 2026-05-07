import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  SyncTraceContext,
} from './logs.types';

const MAX_LOGS = 1000;

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
      scraperGitSha: process.env.SCRAPER_GIT_SHA,
      nodeVersion: process.version,
      nodeEnv: process.env.NODE_ENV ?? 'development',
      browserEngine: 'chromium',
      browserVersion: process.env.CHROMIUM_VERSION,
      osPlatform: `${process.platform}/${process.arch}`,
    };
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
    tenantId?: string;
    workspaceId?: string;
    queueName?: string;
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
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      queueName: input.queueName,
    };
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
  }): string {
    const stable = [
      input.errorKind,
      input.errorStage,
      input.providerId ?? '',
      input.code ?? '',
      input.message.slice(0, 180),
    ].join('|');
    return createHash('sha256').update(stable).digest('hex').slice(0, 16);
  }

  logSyncLifecycle(
    level: LogLevel,
    message: string,
    trace: SyncTraceContext,
    lifecycle: SyncLifecycleEventMeta,
    extraMeta?: Record<string, unknown>,
  ): void {
    this.assertCriticalSyncFields(trace, lifecycle);
    this.add(level, 'sync', message, {
      ...trace,
      ...lifecycle,
      ...extraMeta,
    });
  }

  logSyncFailure(
    trace: SyncTraceContext,
    lifecycle: SyncLifecycleEventMeta,
    failure: SyncFailureMeta,
    extraMeta?: Record<string, unknown>,
  ): void {
    this.assertCriticalSyncFields(trace, lifecycle);
    this.add('ERROR', 'sync', 'step_fail', {
      ...trace,
      ...lifecycle,
      ...failure,
      ...extraMeta,
    });
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
    const missingLifecycle = requiredLifecycle.filter((k) => lifecycle[k] === undefined || lifecycle[k] === null);
    if (missingTrace.length || missingLifecycle.length) {
      this.logger.warn(
        `Critical sync log missing fields: trace=[${missingTrace.join(',')}], lifecycle=[${missingLifecycle.join(',')}]`,
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
        (lower.includes('secret') && key !== 'message')
      ) {
        out[key] = MASKED_TEXT;
        continue;
      }
      if (key === 'credentials' || key === 'encryptedCredentials') {
        out[key] = '[REDACTED]';
        continue;
      }
      if (typeof raw === 'string' && lower.includes('account')) {
        out[key] = this.maskIdentifier(raw);
        continue;
      }
      if (
        typeof raw === 'string' &&
        (lower.endsWith('url') || lower.includes('url'))
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
          e.meta &&
          JSON.stringify(e.meta).toLowerCase().includes(q);
        return inMsg || Boolean(inMeta);
      });
    }
    const lim = Math.min(filters.limit ?? 200, MAX_LOGS);
    return list.slice(0, lim);
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
