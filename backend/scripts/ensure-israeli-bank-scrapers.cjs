// npm git dependency packs only the "files" glob (built lib). HirezRa repo has no lib in git.
// This script replaces the placeholder with a shallow clone and runs build:js.
// https://github.com/HirezRa/israeli-bank-scrapers
const { existsSync, rmSync, renameSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const REPO = 'https://github.com/HirezRa/israeli-bank-scrapers.git';
const backendRoot = process.cwd();
const dir = join(backendRoot, 'node_modules', 'israeli-bank-scrapers');
const yahavLib = join(dir, 'lib', 'scrapers', 'yahav.js');

if (existsSync(yahavLib)) {
  console.log('[ensure-israeli-bank-scrapers] lib already present, skip');
  process.exit(0);
}

if (!existsSync(join(dir, 'package.json'))) {
  console.error(
    '[ensure-israeli-bank-scrapers] node_modules/israeli-bank-scrapers missing — run npm install from backend/',
  );
  process.exit(1);
}

const hasSrc = existsSync(join(dir, 'src', 'scrapers', 'yahav.ts'));
if (!hasSrc) {
  console.log('[ensure-israeli-bank-scrapers] replacing npm placeholder with full clone…');
  const tmp = `${dir}.hirez-clone`;
  if (existsSync(tmp)) {
    rmSync(tmp, { recursive: true, force: true });
  }
  execSync(`git clone --depth 1 "${REPO}" "${tmp}"`, { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  renameSync(tmp, dir);
}

console.log('[ensure-israeli-bank-scrapers] npm install + build:js in fork…');
execSync('npm install --include=dev --no-audit --no-fund && npm run build:js', {
  cwd: dir,
  stdio: 'inherit',
  shell: true,
});
