#!/usr/bin/env sh
# הרצת prisma/inspect-recent-transactions.ts מתוך מאונט המארח (/opt/finance-app)
# עם ts-node מתוך /app/node_modules (מתוך אימג׳ הבאק־אנד).
#
# מהמארח:
#   docker compose exec backend sh /opt/finance-app/scripts/inspect-recent-txns-docker.sh
#   TARGET_YEAR=2026 TARGET_MONTH=5 INSPECT_LIMIT=40 docker compose exec backend sh /opt/finance-app/scripts/inspect-recent-txns-docker.sh
#
# עם limit:
#   docker compose exec backend sh /opt/finance-app/scripts/inspect-recent-txns-docker.sh -- --limit=50
#
set -e
export TARGET_YEAR="${TARGET_YEAR:-2026}"
export TARGET_MONTH="${TARGET_MONTH:-5}"

BACKEND_DIR="/opt/finance-app/backend"
if [ ! -d "$BACKEND_DIR" ]; then
  echo "ERROR: $BACKEND_DIR not found (host repo mount missing on container?)." >&2
  exit 1
fi
cd "$BACKEND_DIR"
export NODE_PATH=/app/node_modules

# Portable: resolve ts-node/register without hardcoding dist path
exec node -r /app/node_modules/ts-node/register prisma/inspect-recent-transactions.ts "$@"
