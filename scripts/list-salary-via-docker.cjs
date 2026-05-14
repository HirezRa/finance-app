'use strict';
/**
 * Lists salary / income rows via Prisma inside the backend container.
 * Uses /opt/finance-app/backend (bind mount) + ts-node from the image (/app/node_modules).
 *
 * Run from repo root (e.g. /opt/finance-app):
 *   node scripts/list-salary-via-docker.cjs --all-income
 *
 * Or from backend/ (after npm script is added):
 *   npm run list:salary-txns:docker -- --all-income
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const passthrough = process.argv.slice(2);
const inner =
  'cd /opt/finance-app/backend && export NODE_PATH=/app/node_modules && exec /app/node_modules/.bin/ts-node prisma/list-salary-transactions.ts "$@"';

const r = spawnSync(
  'docker',
  ['compose', 'exec', '-T', 'backend', 'sh', '-c', inner, 'sh', ...passthrough],
  { cwd: root, stdio: 'inherit', env: process.env },
);

process.exit(r.status === 0 ? 0 : r.status ?? 1);
