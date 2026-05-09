import * as fs from 'fs';
import * as path from 'path';

function hostRepoRoot(): string | undefined {
  const dir = process.env.APP_DIR?.trim();
  return dir && dir.length > 0 ? dir : undefined;
}

export function getVersion(): string {
  try {
    const root = hostRepoRoot();
    const candidates = [
      ...(root ? [path.join(root, 'VERSION')] : []),
      path.join(process.cwd(), 'VERSION'),
      path.join(process.cwd(), '..', 'VERSION'),
    ];
    for (const versionFile of candidates) {
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf-8').trim();
      }
    }

    const packageJson = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf-8')) as {
        version?: string;
      };
      return pkg.version ?? '1.0.0';
    }
  } catch (error) {
    console.error('Error reading version:', error);
  }

  return '1.0.0';
}

export const APP_VERSION = getVersion();

/**
 * Git tag / ref pinned for HirezRa/israeli-bank-scrapers (matches fork release), e.g. hirez-v1.0.14.
 * Parsed from package.json `dependencies["israeli-bank-scrapers"]` after `#`.
 */
export function getIsraeliBankScrapersReleaseRef(): string {
  try {
    const root = hostRepoRoot();
    const pkgPathCandidates = [
      ...(root ? [path.join(root, 'backend', 'package.json')] : []),
      path.join(process.cwd(), 'package.json'),
    ];
    const pkgPath = pkgPathCandidates.find((p) => fs.existsSync(p));
    if (!pkgPath) {
      return 'unknown';
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
    };
    const dep = pkg.dependencies?.['israeli-bank-scrapers']?.trim();
    if (!dep) {
      return 'unknown';
    }
    const hashIdx = dep.lastIndexOf('#');
    if (hashIdx >= 0) {
      const ref = dep.slice(hashIdx + 1).trim();
      return ref || 'unknown';
    }
    return dep;
  } catch {
    return 'unknown';
  }
}
