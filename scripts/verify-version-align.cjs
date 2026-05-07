/**
 * Ensures VERSION (product SemVer) matches frontend/backend package.json
 * and the root entries in both package-lock.json files.
 * Run from anywhere: node scripts/verify-version-align.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readVersionFile() {
  return fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
}

function readPackageJson(rel) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8');
  return JSON.parse(raw).version;
}

function readLockRootVersions(rel) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const top = lock.version;
  const inner = lock.packages?.['']?.version;
  return { top, inner };
}

const expected = readVersionFile();
const places = [
  ['VERSION', expected],
  ['frontend/package.json', readPackageJson('frontend/package.json')],
  ['backend/package.json', readPackageJson('backend/package.json')],
];

const feLock = readLockRootVersions('frontend/package-lock.json');
const beLock = readLockRootVersions('backend/package-lock.json');
places.push(['frontend/package-lock.json (root)', feLock.top]);
places.push(['frontend/package-lock.json (packages[""])', feLock.inner]);
places.push(['backend/package-lock.json (root)', beLock.top]);
places.push(['backend/package-lock.json (packages[""])', beLock.inner]);

let ok = true;
for (const [label, v] of places) {
  if (v !== expected) {
    console.error(`[verify-version-align] mismatch: ${label} = "${v}" (expected "${expected}")`);
    ok = false;
  }
}

if (!ok) {
  console.error(
    '[verify-version-align] Fix: set VERSION and the same SemVer in frontend/package.json, backend/package.json, then run npm install in each to refresh lockfile roots.',
  );
  process.exit(1);
}

console.log(`[verify-version-align] OK — all match ${expected}`);
