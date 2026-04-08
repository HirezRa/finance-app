import * as fs from 'fs';
import * as path from 'path';

export function getVersion(): string {
  try {
    const candidates = [
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
