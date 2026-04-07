#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./backup.sh || true
docker compose build
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
