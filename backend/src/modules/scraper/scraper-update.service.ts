import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface UpdateCheckResult {
  currentCommit: string;
  latestCommit: string;
  updateAvailable: boolean;
  repoUrl: string;
}

@Injectable()
export class ScraperUpdateService {
  private readonly logger = new Logger(ScraperUpdateService.name);
  private readonly REPO_OWNER = 'HirezRa';
  private readonly REPO_NAME = 'israeli-bank-scrapers';

  @Cron(CronExpression.EVERY_WEEK)
  async checkForUpdatesScheduled() {
    this.logger.log('Running weekly scraper update check...');
    try {
      const result = await this.checkForUpdates();
      if (result.updateAvailable) {
        this.logger.warn(
          `Scraper update available! Current: ${result.currentCommit}, Latest: ${result.latestCommit}`,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Scheduled update check failed: ${msg}`);
    }
  }

  async checkForUpdates(): Promise<UpdateCheckResult> {
    const latestCommit = await this.getLatestCommit();
    let currentCommit = 'unknown';
    let updateAvailable = false;
    try {
      const pkgPath = join(
        process.cwd(),
        'node_modules',
        'israeli-bank-scrapers',
        'package.json',
      );
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        gitHead?: string;
        version?: string;
      };
      if (pkg.gitHead && typeof pkg.gitHead === 'string') {
        currentCommit = pkg.gitHead.substring(0, 7);
        updateAvailable = currentCommit !== latestCommit;
      } else {
        currentCommit = pkg.version ?? 'unknown';
        updateAvailable = false;
      }
    } catch {
      /* keep defaults */
    }

    return {
      currentCommit,
      latestCommit,
      updateAvailable,
      repoUrl: `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}`,
    };
  }

  async getLatestCommit(): Promise<string> {
    const response = await fetch(
      `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/commits/main`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'finance-app',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as { sha?: string };
    const sha = data.sha ?? '';
    return sha.substring(0, 7);
  }

  async getCurrentCommit(): Promise<string> {
    try {
      const pkgPath = join(
        process.cwd(),
        'node_modules',
        'israeli-bank-scrapers',
        'package.json',
      );
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        version?: string;
        gitHead?: string;
      };
      if (pkg.gitHead && typeof pkg.gitHead === 'string') {
        return pkg.gitHead.substring(0, 7);
      }
      return pkg.version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async getVersionInfo(): Promise<Record<string, unknown>> {
    try {
      const pkgPath = join(
        process.cwd(),
        'node_modules',
        'israeli-bank-scrapers',
        'package.json',
      );
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        version?: string;
      };
      const updateCheck = await this.checkForUpdates();

      return {
        installedVersion: pkg.version,
        installedCommit: await this.getCurrentCommit(),
        latestCommit: updateCheck.latestCommit,
        updateAvailable: updateCheck.updateAvailable,
        repoUrl: updateCheck.repoUrl,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: message,
        lastChecked: new Date().toISOString(),
      };
    }
  }
}
