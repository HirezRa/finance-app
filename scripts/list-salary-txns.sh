#!/usr/bin/env bash
# Run salary / income listing from repo root (fixes "wrong cwd" and missing npm script until git pull).
# Usage (on host, from /opt/finance-app):
#   chmod +x scripts/list-salary-txns.sh   # once
#   ./scripts/list-salary-txns.sh
#   ./scripts/list-salary-txns.sh --all-income
#   USER_ID=<uuid> ./scripts/list-salary-txns.sh
#
# Inside Docker backend image (after rebuild that includes prisma/*.ts):
#   docker compose exec backend sh -lc 'cd /app && npx ts-node prisma/list-salary-transactions.ts --all-income'
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
if [ ! -f "$BACKEND/prisma/list-salary-transactions.ts" ]; then
  echo "לא נמצא $BACKEND/prisma/list-salary-transactions.ts" >&2
  echo "הרץ: cd $ROOT && git fetch origin main && git checkout main --force && git pull origin main" >&2
  exit 1
fi
cd "$BACKEND"
exec npm run list:salary-txns -- "$@"
