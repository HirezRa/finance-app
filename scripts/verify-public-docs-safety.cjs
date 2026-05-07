/**
 * Blocks common infrastructure fingerprints from public-facing Markdown.
 * Keep in sync with logic in .github/workflows/ci-security.yml (docs-public-safety).
 * Run: node scripts/verify-public-docs-safety.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
/** Same pattern as CI: infra/vendor/host fingerprints should not appear in public docs */
const FORBIDDEN = /(LXC|lxc|Proxmox|pct exec|192\.168\.)/i;

function collectMarkdownFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      collectMarkdownFiles(p, out);
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

const targets = [];
collectMarkdownFiles(path.join(root, 'docs'), targets);
targets.push(path.join(root, 'README.md'));
targets.push(path.join(root, '.github', 'auto-deploy-setup.md'));

let failed = false;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  let m;
  const re = new RegExp(FORBIDDEN.source, FORBIDDEN.flags + 'g');
  while ((m = re.exec(text)) !== null) {
    const line = text.slice(0, m.index).split('\n').length;
    console.error(`[verify-public-docs-safety] ${rel}:${line}: forbidden match "${m[0]}"`);
    failed = true;
  }
}

if (failed) {
  console.error(
    '[verify-public-docs-safety] Remove vendor/host-specific patterns from public docs (use neutral wording; store specifics in internal runbooks).',
  );
  process.exit(1);
}

console.log(`[verify-public-docs-safety] OK — checked ${targets.length} path(s)`);
