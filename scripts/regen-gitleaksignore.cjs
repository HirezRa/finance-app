#!/usr/bin/env node
/** One-shot: rebuild .gitleaksignore from gitleaks-report.json (run gitleaks detect --report-format json first). */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'gitleaks-report.json');
const outPath = path.join(root, '.gitleaksignore');
const raw = fs.readFileSync(reportPath, 'utf8');
const findings = JSON.parse(raw);
const hdr = `# Known false positives (fingerprints). Regenerate after history rewrite or rule changes.
# Generate: rename/remove .gitleaksignore, run:
#   gitleaks detect --config .gitleaks.toml --report-format json --report-path gitleaks-report.json
#   node scripts/regen-gitleaksignore.cjs

`;
const body = findings.map((x) => x.Fingerprint).join('\n');
fs.writeFileSync(outPath, hdr + body + (body ? '\n' : ''), 'utf8');
console.log(`[regen-gitleaksignore] wrote ${findings.length} fingerprint(s) to .gitleaksignore`);
