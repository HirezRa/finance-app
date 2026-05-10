// npm git dependency packs only the "files" glob (built lib). HirezRa repo has no lib in git.
// This script replaces the placeholder with a shallow clone at the same ref as package.json, then build:js.
// After build, applies Finance App overlay for Yahav row parsing (see scraper-overlays/) — keep in sync with HirezRa fork PRs.
// https://github.com/HirezRa/israeli-bank-scrapers
const { existsSync, rmSync, renameSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const REPO = 'https://github.com/HirezRa/israeli-bank-scrapers.git';
const backendRoot = process.cwd();
const dir = join(backendRoot, 'node_modules', 'israeli-bank-scrapers');
const yahavLib = join(dir, 'lib', 'scrapers', 'yahav.js');
const stampPath = join(dir, '.finance-app-scraper-ref');
const overlayPath = join(backendRoot, 'scraper-overlays', 'israeli-bank-scrapers', 'src', 'scrapers', 'yahav.ts');

function wantedGitRef() {
  const rootPkg = JSON.parse(readFileSync(join(backendRoot, 'package.json'), 'utf8'));
  const dep = rootPkg.dependencies?.['israeli-bank-scrapers'];
  if (typeof dep !== 'string') {
    return 'master';
  }
  const m = dep.match(/#([^#@\s]+)\s*$/);
  return m ? m[1].trim() : 'master';
}

const wantedRef = wantedGitRef();

function stampMatches() {
  if (!existsSync(stampPath) || !existsSync(yahavLib)) {
    return false;
  }
  try {
    return readFileSync(stampPath, 'utf8').trim() === wantedRef;
  } catch {
    return false;
  }
}

/**
 * Replace Yahav TS with repo overlay (robust DOM row parsing). Rebuild lib when src differs (e.g. after git checkout).
 */
function applyYahavOverlay() {
  if (!existsSync(overlayPath)) {
    console.log('[ensure-israeli-bank-scrapers] no Yahav overlay file, skip');
    return;
  }
  const targetTs = join(dir, 'src', 'scrapers', 'yahav.ts');
  if (!existsSync(targetTs)) {
    console.warn('[ensure-israeli-bank-scrapers] fork src/scrapers/yahav.ts missing — cannot apply overlay');
    return;
  }

  const overlaySrc = readFileSync(overlayPath, 'utf8');
  let current = '';
  try {
    current = readFileSync(targetTs, 'utf8');
  } catch {
    current = '';
  }

  if (current === overlaySrc) {
    console.log('[ensure-israeli-bank-scrapers] Yahav src already matches overlay, skip rebuild');
    return;
  }

  console.log('[ensure-israeli-bank-scrapers] applying Yahav overlay + build:js…');
  writeFileSync(targetTs, overlaySrc, 'utf8');
  execSync('npm run build:js', {
    cwd: dir,
    stdio: 'inherit',
    shell: true,
  });
  console.log('[ensure-israeli-bank-scrapers] Yahav overlay applied');
}

if (stampMatches()) {
  console.log('[ensure-israeli-bank-scrapers] ref up to date, checking Yahav overlay…');
  applyYahavOverlay();
  process.exit(0);
}

if (!existsSync(join(dir, 'package.json'))) {
  console.error(
    '[ensure-israeli-bank-scrapers] node_modules/israeli-bank-scrapers missing — run npm install from backend/',
  );
  process.exit(1);
}

const hasSrc = existsSync(join(dir, 'src', 'scrapers', 'yahav.ts'));
const hasGit = existsSync(join(dir, '.git'));

if (hasGit && hasSrc) {
  console.log(`[ensure-israeli-bank-scrapers] checkout ${wantedRef}…`);
  execSync(`git fetch --depth 1 origin tag "${wantedRef}"`, { cwd: dir, stdio: 'inherit' });
  execSync(`git checkout -f "${wantedRef}"`, { cwd: dir, stdio: 'inherit' });
} else if (!hasSrc) {
  console.log(`[ensure-israeli-bank-scrapers] replacing npm placeholder with clone at ${wantedRef}…`);
  const tmp = `${dir}.hirez-clone`;
  if (existsSync(tmp)) {
    rmSync(tmp, { recursive: true, force: true });
  }
  execSync(`git clone --depth 1 --branch "${wantedRef}" "${REPO}" "${tmp}"`, { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  renameSync(tmp, dir);
}

console.log('[ensure-israeli-bank-scrapers] npm install + build:js in fork…');
execSync('npm install --include=dev --no-audit --no-fund && npm run build:js', {
  cwd: dir,
  stdio: 'inherit',
  shell: true,
});

writeFileSync(stampPath, `${wantedRef}\n`, 'utf8');
console.log(`[ensure-israeli-bank-scrapers] stamped ${wantedRef}`);

applyYahavOverlay();
