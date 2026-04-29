import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import { LogsService } from '../logs/logs.service';

export interface GithubReleaseDto {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

export type GithubReleaseErrorCode =
  | 'no_token'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'invalid_response';

export interface GithubReleaseResponse {
  success: boolean;
  release: GithubReleaseDto | null;
  messageHe?: string;
  code?: GithubReleaseErrorCode;
}

export interface UpdateStatusStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

export interface UpdateStatus {
  status:
    | 'idle'
    | 'pending'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'rolled-back';
  message: string;
  currentVersion: string;
  targetVersion?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  progress?: number;
  steps?: UpdateStatusStep[];
  buildLog?: string[];
  updatedAt?: string;
}

export interface UpdateHistoryEntry {
  version: string;
  previousVersion: string;
  timestamp: string;
  status: 'success' | 'failed' | 'rolled-back';
  duration: number;
  error?: string;
}

export interface SelfUpdateStatusDto {
  inProgress: boolean;
  stage?: string;
  message?: string;
  progress?: number;
  error?: string;
  updatedAt?: string;
  buildLog?: string[];
}

export interface PerformSelfUpdateResult {
  success: boolean;
  messageHe: string;
  instructionsHe?: string;
}

@Injectable()
export class VersionService implements OnModuleInit {
  private readonly logger = new Logger(VersionService.name);
  private readonly appDir: string;
  private readonly updateDataDir: string;
  private readonly triggerFile: string;
  private readonly statusFile: string;
  private readonly historyFile: string;
  private readonly buildLogFile: string;

  constructor(
    private readonly config: ConfigService,
    private readonly appLogs: LogsService,
  ) {
    this.appDir = this.config.get<string>('APP_DIR', '/opt/finance-app').trim();
    this.updateDataDir = this.config
      .get<string>('UPDATE_DATA_DIR', join(this.appDir, 'update-data'))
      .trim();
    this.triggerFile = join(this.updateDataDir, '.update-requested');
    this.statusFile = join(this.updateDataDir, '.update-status.json');
    this.historyFile = join(this.updateDataDir, '.update-history.json');
    this.buildLogFile = join(this.updateDataDir, 'build.log');
  }

  onModuleInit(): void {
    this.ensureUpdateDataDir();
  }

  private ensureUpdateDataDir(): void {
    try {
      if (!existsSync(this.updateDataDir)) {
        mkdirSync(this.updateDataDir, { recursive: true, mode: 0o777 });
        this.appLogs.add('INFO', 'version', 'נוצרה תיקיית עדכונים', {
          path: this.updateDataDir,
        });
      }
      const files: { path: string; defaultContent: string }[] = [
        { path: this.statusFile, defaultContent: '{}' },
        { path: this.historyFile, defaultContent: '[]' },
        { path: this.buildLogFile, defaultContent: '' },
      ];
      for (const f of files) {
        if (!existsSync(f.path)) {
          writeFileSync(f.path, f.defaultContent, { encoding: 'utf-8', mode: 0o666 });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ensureUpdateDataDir: ${msg}`);
      this.appLogs.add('WARN', 'version', 'שגיאה ביצירת תיקיית עדכונים', { error: msg });
    }
  }

  async getCurrentVersion(): Promise<{ version: string; buildDate?: string }> {
    try {
      const version = this.readVersionFromAppDir(this.appDir);
      return { version };
    } catch {
      return { version: '0.0.0' };
    }
  }

  /** מאגר ציבורי — ללא טוקן GitHub */
  async getLatestGithubRelease(_userId: string): Promise<GithubReleaseResponse> {
    const repo = this.config.get<string>('GITHUB_REPO', 'HirezRa/finance-app').trim();
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'finance-app-version-check',
    };

    const controller = new AbortController();
    const timeoutMs = 12_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const apiStart = Date.now();

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const durationMs = Date.now() - apiStart;

      if (res.status === 404) {
        this.appLogs.add('DEBUG', 'version', 'בדיקת GitHub release — אין release (404)', {
          repo,
          durationMs,
        });
        return {
          success: true,
          release: null,
          messageHe: 'אין release מפורסם במאגר.',
          code: 'not_found',
        };
      }

      if (res.status === 401) {
        this.appLogs.add('WARN', 'version', 'בדיקת GitHub release נכשלה (401)', { repo });
        return {
          success: false,
          release: null,
          messageHe: 'הגישה ל-GitHub נדחתה. נסה שוב מאוחר יותר.',
          code: 'unauthorized',
        };
      }

      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          this.appLogs.add('WARN', 'version', 'בדיקת GitHub release — rate limit', {
            repo,
          });
          return {
            success: false,
            release: null,
            messageHe:
              'חרגת ממגבלת הבקשות ל-GitHub. נסה שוב מאוחר יותר.',
            code: 'rate_limit',
          };
        }
        this.appLogs.add('WARN', 'version', 'בדיקת GitHub release נחסמה (403)', {
          repo,
        });
        return {
          success: false,
          release: null,
          messageHe: 'הגישה ל-GitHub נחסמה (403).',
          code: 'forbidden',
        };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
        this.appLogs.add('WARN', 'version', `בדיקת GitHub release — קוד ${res.status}`, {
          repo,
          snippet: text.slice(0, 300),
        });
        return {
          success: false,
          release: null,
          messageHe: `שגיאה מ-GitHub (קוד ${res.status}). נסה שוב מאוחר יותר.`,
          code: 'network',
        };
      }

      const raw = (await res.json()) as Record<string, unknown>;
      const tag_name = typeof raw.tag_name === 'string' ? raw.tag_name : null;
      if (!tag_name) {
        return {
          success: false,
          release: null,
          messageHe: 'תשובה לא צפויה מ-GitHub. נסה שוב מאוחר יותר.',
          code: 'invalid_response',
        };
      }

      const release: GithubReleaseDto = {
        tag_name,
        name: typeof raw.name === 'string' ? raw.name : tag_name,
        published_at: typeof raw.published_at === 'string' ? raw.published_at : '',
        html_url: typeof raw.html_url === 'string' ? raw.html_url : '',
        body: typeof raw.body === 'string' ? raw.body : '',
      };

      this.appLogs.add('DEBUG', 'version', 'בדיקת GitHub release הצליחה', {
        repo,
        tag: tag_name,
        durationMs,
      });

      return { success: true, release };
    } catch (err: unknown) {
      clearTimeout(timer);
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        this.appLogs.add('WARN', 'version', 'בדיקת GitHub release — timeout', { repo });
        return {
          success: false,
          release: null,
          messageHe: 'פג הזמן בחיבור ל-GitHub. בדוק את הרשת ונסה שוב.',
          code: 'timeout',
        };
      }
      this.logger.error('GitHub release fetch failed', err);
      this.appLogs.add('ERROR', 'version', 'שגיאת רשת בבדיקת GitHub release', {
        repo,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        release: null,
        messageHe: 'שגיאת רשת בבדיקת עדכונים. נסה שוב מאוחר יותר.',
        code: 'network',
      };
    }
  }

  async checkForUpdate(): Promise<{
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseNotes?: string;
    releaseUrl?: string;
  }> {
    const { version: currentVersion } = await this.getCurrentVersion();
    const releaseResp = await this.getLatestGithubRelease('system');
    if (!releaseResp.success || !releaseResp.release) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
      };
    }
    const latestVersion = releaseResp.release.tag_name.replace(/^v/i, '');
    const updateAvailable = this.compareVersions(latestVersion, currentVersion) > 0;
    this.appLogs.add('INFO', 'version', 'בדיקת עדכון בוצעה', {
      currentVersion,
      latestVersion,
      updateAvailable,
    });
    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      releaseNotes: releaseResp.release.body,
      releaseUrl: releaseResp.release.html_url,
    };
  }

  async triggerUpdate(): Promise<{ triggered: boolean; message: string }> {
    try {
      this.ensureUpdateDataDir();
      const status = await this.getUpdateStatus();
      if (status.status === 'in-progress' || status.status === 'pending') {
        return { triggered: false, message: 'עדכון כבר בתהליך' };
      }
      const check = await this.checkForUpdate();
      if (!check.updateAvailable) {
        return { triggered: false, message: 'אין עדכון זמין' };
      }

      writeFileSync(this.buildLogFile, '', 'utf-8');

      writeFileSync(
        this.triggerFile,
        JSON.stringify(
          {
            requestedAt: new Date().toISOString(),
            targetVersion: check.latestVersion,
            requestedBy: 'user',
          },
          null,
          2,
        ),
        'utf-8',
      );

      await this.writeStatus({
        status: 'pending',
        message: 'העדכון ממתין להפעלה',
        currentVersion: check.currentVersion,
        targetVersion: check.latestVersion,
        startedAt: new Date().toISOString(),
        progress: 1,
      });

      this.appLogs.add('INFO', 'version', 'עדכון הופעל', {
        targetVersion: check.latestVersion,
      });

      return {
        triggered: true,
        message: `עדכון לגרסה ${check.latestVersion} הופעל`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.appLogs.add('ERROR', 'version', 'שגיאה בהפעלת עדכון', { error: msg });
      return { triggered: false, message: `שגיאה: ${msg}` };
    }
  }

  async getUpdateStatus(): Promise<UpdateStatus> {
    const currentVersion = this.readVersionFromAppDir(this.appDir);
    try {
      this.ensureUpdateDataDir();

      if (!existsSync(this.statusFile)) {
        return {
          status: 'idle',
          message: 'לא מתבצע עדכון',
          currentVersion,
        };
      }

      const content = readFileSync(this.statusFile, 'utf-8').trim();
      if (!content || content === '{}') {
        return {
          status: 'idle',
          message: 'לא מתבצע עדכון',
          currentVersion,
        };
      }

      const parsed = JSON.parse(content) as UpdateStatus;
      const merged: UpdateStatus = {
        ...parsed,
        currentVersion: parsed.currentVersion ?? currentVersion,
      };

      if (
        ['in-progress', 'failed', 'rolled-back'].includes(merged.status) &&
        existsSync(this.buildLogFile)
      ) {
        const logContent = readFileSync(this.buildLogFile, 'utf-8');
        merged.buildLog = logContent
          .split('\n')
          .filter((line) => line.trim())
          .slice(-30);
      }

      return merged;
    } catch {
      return {
        status: 'idle',
        message: 'לא מתבצע עדכון',
        currentVersion,
      };
    }
  }

  async clearBuildLog(): Promise<{ cleared: boolean }> {
    try {
      this.ensureUpdateDataDir();
      if (existsSync(this.buildLogFile)) {
        writeFileSync(this.buildLogFile, '', { encoding: 'utf-8', mode: 0o666 });
      }
      this.appLogs.logUpdate('לוג בנייה נוקה', { path: this.buildLogFile });
      return { cleared: true };
    } catch {
      return { cleared: false };
    }
  }

  async cancelUpdate(): Promise<{ cancelled: boolean; message: string }> {
    try {
      const status = await this.getUpdateStatus();
      if (status.status !== 'pending') {
        return {
          cancelled: false,
          message: 'לא ניתן לבטל עדכון שכבר התחיל',
        };
      }
      if (existsSync(this.triggerFile)) {
        unlinkSync(this.triggerFile);
      }
      await this.writeStatus({
        status: 'idle',
        message: 'העדכון בוטל',
        currentVersion: status.currentVersion,
      });
      this.appLogs.add('INFO', 'version', 'עדכון בוטל');
      return { cancelled: true, message: 'העדכון בוטל' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { cancelled: false, message: `שגיאה: ${msg}` };
    }
  }

  async getUpdateHistory(): Promise<UpdateHistoryEntry[]> {
    try {
      this.ensureUpdateDataDir();
      if (!existsSync(this.historyFile)) {
        return [];
      }
      const content = readFileSync(this.historyFile, 'utf-8').trim();
      if (!content) return [];

      try {
        const parsed = JSON.parse(content) as UpdateHistoryEntry[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        const rows = content
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        return rows
          .map((line) => {
            try {
              return JSON.parse(line) as UpdateHistoryEntry;
            } catch {
              return null;
            }
          })
          .filter((x): x is UpdateHistoryEntry => Boolean(x));
      }
    } catch {
      return [];
    }
  }

  private async writeStatus(status: UpdateStatus): Promise<void> {
    this.ensureUpdateDataDir();
    const next: UpdateStatus = {
      ...status,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(this.statusFile, JSON.stringify(next, null, 2), 'utf-8');
  }

  private readVersionFromAppDir(appDir: string): string {
    try {
      return readFileSync(join(appDir, 'VERSION'), 'utf-8').trim();
    } catch {
      return '0.0.0';
    }
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.replace(/^v/i, '').split('.').map((n) => Number(n || 0));
    const partsB = b.replace(/^v/i, '').split('.').map((n) => Number(n || 0));
    const len = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < len; i++) {
      const pa = partsA[i] || 0;
      const pb = partsB[i] || 0;
      if (pa > pb) return 1;
      if (pa < pb) return -1;
    }
    return 0;
  }

  getSelfUpdateStatus(): SelfUpdateStatusDto {
    const empty: SelfUpdateStatusDto = { inProgress: false };
    try {
      this.ensureUpdateDataDir();
      if (!existsSync(this.statusFile)) return empty;
      const status = JSON.parse(readFileSync(this.statusFile, 'utf-8')) as UpdateStatus;
      const dto: SelfUpdateStatusDto = {
        inProgress: status.status === 'in-progress' || status.status === 'pending',
        stage: status.status,
        message: status.message,
        progress: status.progress,
        error: status.error,
        updatedAt: status.updatedAt,
      };
      if (
        (status.status === 'in-progress' || status.status === 'failed') &&
        existsSync(this.buildLogFile)
      ) {
        const logContent = readFileSync(this.buildLogFile, 'utf-8');
        dto.buildLog = logContent
          .split('\n')
          .filter((line) => line.trim())
          .slice(-20);
      }
      return dto;
    } catch {
      return empty;
    }
  }

  async performSelfUpdate(): Promise<PerformSelfUpdateResult> {
    const res = await this.triggerUpdate();
    return {
      success: res.triggered,
      messageHe: res.message,
      instructionsHe: res.triggered
        ? undefined
        : "העדכון לא הופעל. בדוק ש-service 'finance-app-updater.path' פעיל על ה-LXC.",
    };
  }
}
