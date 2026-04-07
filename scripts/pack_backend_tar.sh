#!/usr/bin/env bash
# Pack backend tarball for deploy (run from repo root)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-${ROOT}/deploy_out/finance_backend_latest.tar.gz}"
cd "${ROOT}/backend"
tar -czf "${OUT}" \
  --exclude=node_modules \
  --exclude=dist \
  --exclude='*.log' \
  .
echo "Wrote ${OUT}"
