#!/usr/bin/env bash
set -euo pipefail
cd /opt/finance-app
./backup.sh || true
docker compose build
docker compose run --rm backend npx prisma migrate deploy
docker compose up -d
