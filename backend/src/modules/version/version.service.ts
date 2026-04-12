import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { SettingsService } from '../settings/settings.service';

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

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  private readonly updateStatusPath =
    process.env.UPDATE_STATUS_FILE ?? '/tmp/finance-app-update-status.json';
  private readonly updateLockPath =
    process.env.UPDATE_LOCK_FILE ?? '/tmp/finance-app-update.lock';

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
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
          return {
            success: false,
            release: null,
            messageHe:
              'חרגת ממגבלת הבקשות ל-GitHub. נסה שוב מאוחר יותר או הגדר טוקן בהגדרות.',
            code: 'rate_limit',
          };
        }
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
        return {
          success: false,
          release: null,
          messageHe: 'פג הזמן בחיבור ל-GitHub. בדוק את הרשת ונסה שוב.',
          code: 'timeout',
        };
      }
      this.logger.error('GitHub release fetch failed', err);
      return {
        success: false,
        release: null,
        messageHe: 'שגיאת רשת בבדיקת עדכונים. נסה שוב מאוחר יותר.',
        code: 'network',
      };
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
   * Starts scripts/self-update.sh detached (requires APP_DIR mount + docker.sock + SELF_UPDATE_ENABLED=true).
   */
  performSelfUpdate(): { success: boolean; messageHe: string } {
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

    if (!existsSync(scriptPath)) {
      return {
        success: false,
        messageHe: 'קובץ scripts/self-update.sh לא נמצא. ודא שהריפו מעודכן וש-APP_DIR נכון.',
      };
    }
    if (!existsSync('/var/run/docker.sock')) {
      return {
        success: false,
        messageHe: 'Docker socket לא זמין בקונטיינר — הוסף mount ל-/var/run/docker.sock ב-docker-compose.',
      };
    }
    if (existsSync(this.updateLockPath)) {
      return {
        success: false,
        messageHe: 'עדכון כבר מתבצע. נסה שוב מאוחר יותר.',
      };
    }

    this.writeLocalUpdateStatus({
      inProgress: true,
      stage: 'queued',
      message: 'מפעיל סקריפט עדכון...',
      progress: 2,
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
      return {
        success: false,
        messageHe: 'לא ניתן להפעיל את תהליך העדכון.',
      };
    }

    return {
      success: true,
      messageHe:
        'העדכון החל ברקע. הבנייה וההפעלה מחדש עשויים לקחת מספר דקות; אל תסגור את הדפדפן.',
    };
  }
}
