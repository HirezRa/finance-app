/**
 * Fails if any tracked file matches data-export / scratch-query patterns.
 * Complements .gitignore — catches files already committed before ignore rules existed.
 * Run: node scripts/verify-no-data-exports.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  { id: 'CSV', re: /\.csv$/i },
  { id: 'TSV', re: /\.tsv$/i },
  { id: 'XLSX', re: /\.xlsx$/i },
  { id: 'DUMP', re: /\.dump$/i },
  { id: 'SQL_GZ', re: /\.sql\.gz$/i },
  { id: 'SCRATCH_SQL', re: /^scripts\/tmp-/i },
  { id: 'EXPORT_SQL', re: /^scripts\/export-.*\.sql$/i },
  { id: 'SIMULATE_TS', re: /^backend\/prisma\/simulate-.*\.ts$/i },
  { id: 'SCREENSHOT_CJS', re: /-screenshot\.cjs$/i },
];

function listTrackedFiles() {
  const r = spawnSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('[verify-no-data-exports] git ls-files failed');
    process.exit(1);
  }
  return r.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

let failed = false;
const tracked = listTrackedFiles();

for (const rel of tracked) {
  const posix = rel.replace(/\\/g, '/');
  for (const { id, re } of FORBIDDEN_PATTERNS) {
    if (re.test(posix)) {
      console.error(`[verify-no-data-exports] ${id} tracked file must not be committed: ${posix}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    '[verify-no-data-exports] Remove data-export files from git history/index (git rm --cached) and keep them local-only.',
  );
  process.exit(1);
}

console.log(`[verify-no-data-exports] OK — checked ${tracked.length} tracked file(s)`);
