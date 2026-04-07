#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  chmod +x scripts/generate_env.sh 2>/dev/null || true
  ./scripts/generate_env.sh
fi

mkdir -p data/postgres data/redis backups logs nginx/ssl

echo "Building images..."
docker compose build

echo "Starting db + redis..."
docker compose up -d db redis
sleep 8

echo "Migrating database..."
docker compose run --rm backend npx prisma migrate deploy

echo "Starting all services..."
docker compose up -d

echo "Done. Open http://$(hostname -I | awk '{print $1}')"
echo "Bull Board (if used): http://$(hostname -I | awk '{print $1}'):3001"
