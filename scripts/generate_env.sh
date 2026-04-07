#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then
  echo ".env already exists; skipping"
  exit 0
fi
cp .env.example .env
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
sed -i "s|CHANGE_ME_STRONG_PASSWORD|${DB_PASSWORD}|g" .env
sed -i "s|CHANGE_ME_JWT|${JWT_SECRET}|g" .env
sed -i "s|CHANGE_ME_JWT_REFRESH|${JWT_REFRESH_SECRET}|g" .env
sed -i "s|CHANGE_ME_ENC_KEY|${ENCRYPTION_KEY}|g" .env
# DATABASE_URL uses same password placeholder twice in example
sed -i "s|postgresql://finance:CHANGE_ME_STRONG_PASSWORD@|postgresql://finance:${DB_PASSWORD}@|g" .env 2>/dev/null || true
echo "Generated .env (secrets not printed)."
