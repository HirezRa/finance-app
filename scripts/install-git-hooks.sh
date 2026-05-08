#!/usr/bin/env bash
# Sets repo-local Git hooks (pre-commit sensitive scan). Run from repo root:
#   bash scripts/install-git-hooks.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
echo "Configured core.hooksPath=.githooks for $(git rev-parse --show-toplevel)"
