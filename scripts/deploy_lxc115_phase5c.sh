#!/usr/bin/env bash
set -euo pipefail

# Run on Proxmox host after tars are in /tmp/ (see deploy_out/ or scp instructions).
pct push 115 /tmp/finance_backend_phase5c.tar.gz /tmp/finance_backend_phase5c.tar.gz
pct push 115 /tmp/finance_frontend_phase5c.tar.gz /tmp/finance_frontend_phase5c.tar.gz

pct exec 115 -- bash -c '
set -euo pipefail
cd /opt/finance-app

cp .env /tmp/.env.backup 2>/dev/null || true
cp docker-compose.yml /tmp/docker-compose.backup.yml 2>/dev/null || true

cd /opt/finance-app/backend
rm -rf src prisma package.json tsconfig.json 2>/dev/null || true
tar -xzf /tmp/finance_backend_phase5c.tar.gz

cd /opt/finance-app/frontend
rm -rf src public package.json vite.config.ts 2>/dev/null || true
tar -xzf /tmp/finance_frontend_phase5c.tar.gz

cd /opt/finance-app
cp /tmp/.env.backup .env 2>/dev/null || true

docker compose down
docker compose build --no-cache
docker compose up -d

# One-time dedup after deploy (safe if no duplicates)
docker compose exec -T backend npx ts-node prisma/cleanup-duplicates.ts

rm -f /tmp/finance_backend_phase5c.tar.gz /tmp/finance_frontend_phase5c.tar.gz

docker compose ps
'

rm -f /tmp/finance_backend_phase5c.tar.gz /tmp/finance_frontend_phase5c.tar.gz

echo "Deploy script finished on Proxmox host."
