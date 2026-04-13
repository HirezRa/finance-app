import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { SettingsService } from '../settings/settings.service';
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

export interface SelfUpdateStatusDto {
  inProgress: boolean;
  stage?: string;
  message?: string;
  progress?: number;
  error?: string;
  updatedAt?: string;
}

export interface PerformSelfUpdateResult {
  success: boolean;
  messageHe: string;
  /** הוראות עדכון ידני כשהאוטומטי נכשל או לא זמין */
  instructionsHe?: string;
}

const execFileAsync = promisify(execFile);

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  private readonly updateStatusPath =
    process.env.UPDATE_STATUS_FILE ?? '/tmp/finance-app-update-status.json';
  private readonly updateLockPath =
    process.env.UPDATE_LOCK_FILE ?? '/tmp/finance-app-update.lock';

  private readonly manualUpdateInstructionsHe = `להתקנה ידנית על שרת Proxmox / LXC (מההוסט, לא מתוך הקונטיינר):

pct exec <CTID> -- bash -lc 'cd /opt/finance-app && git pull origin main && docker compose build --no-cache backend frontend && docker compose up -d'

או מתוך CT אחרי pct enter: cd /opt/finance-app && git pull origin main && docker compose build --no-cache backend frontend && docker compose up -d`;

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly appLogs: LogsService,
  ) {}

  async getLatestGithubRelease(userId: string): Promise<GithubReleaseResponse> {
    const repo = this.config
      .get<string>('GITHUB_REPO', 'HirezRa/finance-app')
      .trim();
    const stored = await this.settingsService.getDecryptedGithubReleaseToken(
      userId,
    );
    const token = (
      stored ??
      (this.config.get<string>('GITHUB_TOKEN') ?? '')
    ).trim();

    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'finance-app-version-check',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutMs = 12_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404) {
        return {
          success: true,
          release: null,
          messageHe: 'אין release מפורסם במאגר.',
          code: 'not_found',
        };
      }

      if (res.status === 401) {
        this.appLogs.add('WARN', 'system', 'בדיקת GitHub release נכשלה (401)', {
          repo,
          hadToken: Boolean(token),
        });
        return {
          success: false,
          release: null,
          messageHe: token
            ? 'הטוקן ל-GitHub נדחה. בדוק את הטוקן בהגדרות > תצוגה.'
            : 'מאגר פרטי או דורש הרשאה. הגדר טוקן GitHub בהגדרות > תצוגה > בדיקת עדכונים.',
          code: token ? 'unauthorized' : 'no_token',
        };
      }

      if (res.status === 403) {
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          this.appLogs.add('WARN', 'system', 'בדיקת GitHub release — rate limit', {
            repo,
          });
          return {
            success: false,
            release: null,
            messageHe:
              'חרגת ממגבלת הבקשות ל-GitHub. נסה שוב מאוחר יותר או הגדר טוקן בהגדרות.',
            code: 'rate_limit',
          };
        }
        this.appLogs.add('WARN', 'system', 'בדיקת GitHub release נחסמה (403)', {
          repo,
        });
        return {
          success: false,
          release: null,
          messageHe: 'הגישה ל-GitHub נחסמה (403). בדוק הרשאות המאגר או את הטוקן.',
          code: 'forbidden',
        };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
        this.appLogs.add('WARN', 'system', `בדיקת GitHub release — קוד ${res.status}`, {
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
      const tag_name =
        typeof raw.tag_name === 'string' ? raw.tag_name : null;
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
        published_at:
          typeof raw.published_at === 'string' ? raw.published_at : '',
        html_url: typeof raw.html_url === 'string' ? raw.html_url : '',
        body: typeof raw.body === 'string' ? raw.body : '',
      };

      return { success: true, release };
    } catch (err: unknown) {
      clearTimeout(timer);
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        this.appLogs.add('WARN', 'system', 'בדיקת GitHub release — timeout', { repo });
        return {
          success: false,
          release: null,
          messageHe: 'פג הזמן בחיבור ל-GitHub. בדוק את הרשת ונסה שוב.',
          code: 'timeout',
        };
      }
      this.logger.error('GitHub release fetch failed', err);
      this.appLogs.add('ERROR', 'system', 'שגיאת רשת בבדיקת GitHub release', {
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

  private async probeGitFetch(appDir: string): Promise<
    { ok: true } | { ok: false; detail: string }
  > {
    try {
      await execFileAsync('git', ['-C', appDir, 'fetch', 'origin'], {
        timeout: 35_000,
        maxBuffer: 512 * 1024,
      });
      this.appLogs.add('DEBUG', 'system', 'בדיקת git fetch לפני self-update הצליחה', {
        appDir,
      });
      return { ok: true };
    } catch (e: unknown) {
      const ex = e as { stderr?: Buffer | string; message?: string };
      const stderr =
        typeof ex.stderr === 'string'
          ? ex.stderr
          : Buffer.isBuffer(ex.stderr)
            ? ex.stderr.toString('utf-8')
            : '';
      const detail = String(stderr || ex.message || e).trim().slice(0, 2500);
      this.appLogs.add('ERROR', 'system', 'git fetch נכשל לפני הפעלת self-update', {
        appDir,
        detail: detail || '(אין פלט)',
      });
      return { ok: false, detail };
    }
  }

  private writeLocalUpdateStatus(payload: SelfUpdateStatusDto): void {
    try {
      writeFileSync(
        this.updateStatusPath,
        JSON.stringify({
          ...payload,
          updatedAt: new Date().toISOString(),
        }),
        'utf-8',
      );
    } catch (e) {
      this.logger.warn('Failed to write update status file', e);
    }
  }

  getSelfUpdateStatus(): SelfUpdateStatusDto {
    try {
      if (existsSync(this.updateStatusPath)) {
        const raw = readFileSync(this.updateStatusPath, 'utf-8');
        const status = JSON.parse(raw) as SelfUpdateStatusDto & {
          updatedAt?: string;
        };
        if (status.inProgress && status.updatedAt) {
          const ageMin =
            (Date.now() - new Date(status.updatedAt).getTime()) / 60_000;
          if (ageMin > 45) {
            return {
              inProgress: false,
              stage: 'stale',
              message:
                'סטטוס העדכון לא התעדכן זמן רב — ייתכן שהתהליך נתקע. בדוק ידנית את השרת.',
              progress: 0,
            };
          }
        }
        return status;
      }
    } catch (e) {
      this.logger.warn('Failed to read update status', e);
    }
    return { inProgress: false };
  }

  /**
   * מתחיל scripts/self-update.sh ברקע (בדרך כלל מתוך קונטיינר backend עם APP_DIR + docker.sock).
   * מומלץ לטווח ארוך להריץ עדכון מההוסט (cron) — כאן מתועדות שגיאות ב-LogsService ונשלחות הוראות ידניות.
   */
  async performSelfUpdate(): Promise<PerformSelfUpdateResult> {
    const enabled = this.config
      .get<string>('SELF_UPDATE_ENABLED', 'false')
      .toLowerCase();
    if (enabled !== 'true') {
      throw new ForbiddenException(
        'עדכון אוטומטי כבוי בשרת. הגדר SELF_UPDATE_ENABLED=true ובטל רק אם סומכים על הרצת Docker מהממשק.',
      );
    }

    const appDir = this.config.get<string>('APP_DIR', '/opt/finance-app').trim();
    const scriptPath = join(appDir, 'scripts', 'self-update.sh');
    const hostLogFile = join(appDir, 'logs', 'self-update.log');

    if (!existsSync(scriptPath)) {
      this.appLogs.add('ERROR', 'system', 'סקריפט self-update לא נמצא', {
        scriptPath,
      });
      return {
        success: false,
        messageHe:
          'קובץ scripts/self-update.sh לא נמצא. ודא שהריפו מעודכן וש-APP_DIR נכון.',
        instructionsHe: this.manualUpdateInstructionsHe,
      };
    }
    if (!existsSync('/var/run/docker.sock')) {
      this.appLogs.add('WARN', 'system', 'self-update בוטל — אין docker.sock בקונטיינר', {
        appDir,
      });
      return {
        success: false,
        messageHe:
          'Docker socket לא זמין בקונטיינר. מומלץ להריץ עדכון מההוסט (pct exec) או לעדכן docker-compose.',
        instructionsHe: this.manualUpdateInstructionsHe,
      };
    }
    if (existsSync(this.updateLockPath)) {
      return {
        success: false,
        messageHe: 'עדכון כבר מתבצע. נסה שוב מאוחר יותר.',
        instructionsHe: this.manualUpdateInstructionsHe,
      };
    }

    const fetchProbe = await this.probeGitFetch(appDir);
    if (!fetchProbe.ok) {
      return {
        success: false,
        messageHe:
          'שגיאת git fetch — ייתכן מפתח SSH, הרשאות או רשת. פרטים בלוגי המערכת ובקובץ הלוג אם קיים.',
        instructionsHe: this.manualUpdateInstructionsHe,
      };
    }

    this.writeLocalUpdateStatus({
      inProgress: true,
      stage: 'queued',
      message: 'מפעיל סקריפט עדכון...',
      progress: 2,
    });

    this.appLogs.add('INFO', 'system', 'הופעל עדכון אוטומטי מהממשק', {
      appDir,
      logFile: hostLogFile,
      note: 'הסקריפט רץ בהקשר הקונטיינר; לוג מומלץ: APP_DIR/logs/self-update.log על ההוסט',
    });

    const child = spawn('sh', [scriptPath], {
      detached: true,
      stdio: 'ignore',
      cwd: appDir,
      env: {
        ...process.env,
        APP_DIR: appDir,
        UPDATE_STATUS_FILE: this.updateStatusPath,
        UPDATE_LOCK_FILE: this.updateLockPath,
        UPDATE_LOG_FILE: hostLogFile,
      },
    });
    child.unref();

    if (child.pid === undefined) {
      this.writeLocalUpdateStatus({
        inProgress: false,
        stage: 'failed',
        message: 'לא ניתן להפעיל את תהליך העדכון.',
        progress: 0,
        error: 'spawn failed',
      });
      this.appLogs.add('ERROR', 'system', 'spawn ל-self-update נכשל', { appDir });
      return {
        success: false,
        messageHe: 'לא ניתן להפעיל את תהליך העדכון.',
        instructionsHe: this.manualUpdateInstructionsHe,
      };
    }

    return {
      success: true,
      messageHe:
        'העדכון החל ברקע. הבנייה וההפעלה מחדש עשויים לקחת מספר דקות; לוג: logs/self-update.log תחת תיקיית האפליקציה (על ההוסט).',
    };
  }
}
