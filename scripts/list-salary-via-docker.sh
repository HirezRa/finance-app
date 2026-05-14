#!/usr/bin/env bash
# Run list-salary-transactions.ts inside the backend container using:
# - TypeScript + deps from the image (/app/node_modules)
# - Source from the bind-mounted repo (/opt/finance-app/backend/...) so no rebuild is needed for script edits.
#
# Usage (from repo root, e.g. /opt/finance-app):
#   chmod +x scripts/list-salary-via-docker.sh   # once
#   ./scripts/list-salary-via-docker.sh --all-income
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec docker compose exec -T backend sh -c \
  'cd /opt/finance-app/backend && export NODE_PATH=/app/node_modules && exec /app/node_modules/.bin/ts-node prisma/list-salary-transactions.ts "$@"' \
  sh "$@"
