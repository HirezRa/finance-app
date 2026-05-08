/**
 * Lightweight repo scan for high-risk patterns (complements gitleaks / trufflehog).
 * Excludes vendor trees and lockfiles. Run: node scripts/verify-sensitive-repo-patterns.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.cursor',
  'mcps',
  '.claude',
]);

const SKIP_FILE_RE =
  /package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|\.min\.js$/i;

/** PEM private key blocks */
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

/** Private/loopback IPv4 — four octets only (avoids semver false positives). */
const OCT = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)';
const PRIVATE_IP = new RegExp(
  `\\b(?:10\\.${OCT}\\.${OCT}\\.${OCT}|127\\.${OCT}\\.${OCT}\\.${OCT}|192\\.168\\.${OCT}\\.${OCT}|172\\.(?:1[6-9]|2\\d|3[01])\\.${OCT}\\.${OCT})\\b`,
);

const TEXT_EXT = new Set([
  '.md',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.cjs',
  '.mjs',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
  '.env',
  '.example',
  '.tf',
  '.tfvars',
  '.conf',
  '.ini',
  '.sql',
]);

function shouldScanFile(relPosix, base) {
  if (SKIP_FILE_RE.test(relPosix)) return false;
  const ext = path.extname(base).toLowerCase();
  if (base === '.env.example' || base.endsWith('.env.example')) return true;
  return TEXT_EXT.has(ext);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const name = ent.name;
    const full = path.join(dir, name);
    const rel = path.relative(root, full);
    const relPosix = rel.split(path.sep).join('/');
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      walk(full, out);
    } else if (ent.isFile() && shouldScanFile(relPosix, name)) {
      out.push(full);
    }
  }
  return out;
}

function scanFile(absPath) {
  const relPosix = path.relative(root, absPath).split(path.sep).join('/');
  let buf;
  try {
    buf = fs.readFileSync(absPath);
  } catch {
    return [];
  }
  if (buf.includes(0)) return [];
  const text = buf.toString('utf8');
  const hits = [];
  const patterns = [
    ['PRIVATE_KEY_MATERIAL', PRIVATE_KEY],
    ['PRIVATE_OR_INTERNAL_IP', PRIVATE_IP],
  ];
  for (const [id, re] of patterns) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = r.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      hits.push({ id, line, snippet: m[0].slice(0, 80) });
    }
  }
  return hits.map((h) => ({ ...h, rel: relPosix }));
}

let files = [];
walk(root, files);

let failed = false;
for (const f of files) {
  const hits = scanFile(f);
  for (const h of hits) {
    console.error(
      `[verify-sensitive-repo-patterns] ${h.id} ${h.rel}:${h.line} (redacted preview length=${h.snippet.length})`,
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    '[verify-sensitive-repo-patterns] Remove private key material and internal/private IPs from the repo (use placeholders / secrets manager).',
  );
  process.exit(1);
}

console.log(`[verify-sensitive-repo-patterns] OK — scanned ${files.length} file(s)`);
