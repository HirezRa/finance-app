/**
 * Runs the same Node-based security/doc/version checks used in CI (without Gitleaks/Docker).
 * Usage from repo root: node scripts/run-local-security-checks.cjs
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const checks = [
  'verify-sensitive-repo-patterns.cjs',
  'verify-public-docs-safety.cjs',
  'verify-version-align.cjs',
];

for (const file of checks) {
  const script = path.join(__dirname, file);
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

console.log('[run-local-security-checks] All checks passed.');
