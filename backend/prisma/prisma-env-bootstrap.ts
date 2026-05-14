/**
 * Loads KEY=VAL from standard .env locations into `process.env` before PrismaClient
 * reads `DATABASE_URL`. Used by prisma/*.ts scripts run on the host (not via Docker).
 *
 * Tries (first match wins per key; does not override already-set env):
 * - `prisma/.env` (next to this file)
 * - `backend/.env`
 * - repo root `.env` (parent of `backend/`)
 */
import * as fs from 'fs';
import * as path from 'path';

function parseLine(line: string): { key: string; val: string } | null {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  const noExport = t.startsWith('export ') ? t.slice(7).trim() : t;
  const eq = noExport.indexOf('=');
  if (eq <= 0) return null;
  const key = noExport.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  let val = noExport.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  return { key, val };
}

function loadFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const p = parseLine(line);
    if (!p) continue;
    if (process.env[p.key] === undefined) {
      process.env[p.key] = p.val;
    }
  }
}

const prismaDir = __dirname;
const backendDir = path.join(prismaDir, '..');
const repoRoot = path.join(backendDir, '..');

loadFile(path.join(prismaDir, '.env'));
loadFile(path.join(backendDir, '.env'));
loadFile(path.join(repoRoot, '.env'));
