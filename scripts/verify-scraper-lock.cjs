/**
 * Ensures backend/package-lock.json pins the same Git commit as the
 * israeli-bank-scrapers ref in backend/package.json (e.g. hirez-v1.0.24 → ce1b773).
 *
 * npm can lock a later commit on master; postinstall checks out the tag, but
 * npm ci should still match the tag for deterministic installs.
 *
 * Run: node scripts/verify-scraper-lock.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const backendPkg = JSON.parse(
  fs.readFileSync(path.join(root, 'backend', 'package.json'), 'utf8'),
);
const lock = JSON.parse(
  fs.readFileSync(path.join(root, 'backend', 'package-lock.json'), 'utf8'),
);

const REPO = 'https://github.com/HirezRa/israeli-bank-scrapers.git';

function wantedRef() {
  const dep = backendPkg.dependencies?.['israeli-bank-scrapers'];
  if (typeof dep !== 'string') {
    throw new Error('backend/package.json: missing israeli-bank-scrapers dependency');
  }
  const m = dep.match(/#([^#@\s]+)\s*$/);
  if (!m) {
    throw new Error(`backend/package.json: cannot parse git ref from "${dep}"`);
  }
  return m[1].trim();
}

function lockedSha() {
  const resolved =
    lock.packages?.['node_modules/israeli-bank-scrapers']?.resolved ||
    lock.packages?.['node_modules/@hirez10/israeli-bank-scrapers']?.resolved;
  if (!resolved) {
    throw new Error('backend/package-lock.json: israeli-bank-scrapers resolved URL missing');
  }
  const m = resolved.match(/#([0-9a-f]{40})$/i);
  if (!m) {
    throw new Error(`backend/package-lock.json: cannot parse SHA from "${resolved}"`);
  }
  return m[1].toLowerCase();
}

function resolveRefToSha(ref) {
  try {
    const out = execSync(`git ls-remote "${REPO}" "refs/tags/${ref}"`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    const line = out.split('\n').find(l => l.endsWith(`refs/tags/${ref}`));
    if (!line) {
      throw new Error(`tag not found: ${ref}`);
    }
    return line.split(/\s+/)[0].toLowerCase();
  } catch (e) {
    console.error(`[verify-scraper-lock] git ls-remote failed for ${ref}: ${e.message}`);
    process.exit(1);
  }
}

const ref = wantedRef();
const expected = resolveRefToSha(ref);
const actual = lockedSha();

if (actual !== expected) {
  console.error(
    `[verify-scraper-lock] mismatch: lockfile pins ${actual}, tag ${ref} is ${expected}`,
  );
  console.error(
    '[verify-scraper-lock] Fix: in backend/, run npm install --package-lock-only --ignore-scripts after setting #hirez-v* in package.json, or edit resolved SHA in package-lock.json.',
  );
  process.exit(1);
}

console.log(`[verify-scraper-lock] OK — lockfile matches ${ref} (${expected.slice(0, 7)})`);
