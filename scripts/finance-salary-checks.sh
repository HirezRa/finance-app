#!/usr/bin/env sh
# רצף בדיקות + dry-run לריפוי משכורות/תאריכים — להרצה על המארח (Proxmox) בתיקיית הריפו.
#
#   ssh <user>@<host>
#   cd /opt/finance-app && git pull
#   sh scripts/finance-salary-checks.sh
#
# ביצוע אמיתי ב-DB (אחרי גיבוי!):
#   APPLY_FIXES=1 sh scripts/finance-salary-checks.sh
#
set -e
REPO_ROOT="${FINANCE_REPO_ROOT:-/opt/finance-app}"
BACKEND_DIR="$REPO_ROOT/backend"
export TARGET_YEAR="${TARGET_YEAR:-2026}"
export TARGET_MONTH="${TARGET_MONTH:-5}"
export BANK_YEAR="${BANK_YEAR:-$TARGET_YEAR}"
export BANK_MONTH="${BANK_MONTH:-$TARGET_MONTH}"
APPLY="${APPLY_FIXES:-0}"

cd "$REPO_ROOT" || {
  echo "ERROR: cd $REPO_ROOT failed" >&2
  exit 1
}

if [ ! -d "$BACKEND_DIR" ]; then
  echo "ERROR: backend dir missing: $BACKEND_DIR" >&2
  exit 1
fi

echo "=== finance-salary-checks (repo=$REPO_ROOT, YEAR=$TARGET_YEAR MONTH=$TARGET_MONTH) ==="

echo ""
echo "--- 1) docker compose ps (backend) ---"
docker compose ps backend 2>/dev/null || docker compose ps 2>/dev/null || true

echo ""
echo "--- 2) health ---"
docker compose exec -T backend sh -lc \
  'node -e "require(\"http\").get(\"http://localhost:\"+(process.env.PORT||3000)+\"/api/v1/health\",r=>{let b=\"\";r.on(\"data\",d=>b+=d);r.on(\"end\",()=>{console.log(r.statusCode,b.slice(0,200));process.exit(r.statusCode===200?0:1);});}).on(\"error\",e=>{console.error(e);process.exit(1);});"' \
  || echo "WARN: health check failed"

echo ""
echo "--- 3) inspect-recent-transactions (no DB writes) ---"
if [ -f "$REPO_ROOT/scripts/inspect-recent-txns-docker.sh" ]; then
  docker compose exec -T backend sh "$REPO_ROOT/scripts/inspect-recent-txns-docker.sh" -- --limit=30
else
  docker compose exec -T backend sh -lc \
    "cd $BACKEND_DIR && NODE_PATH=/app/node_modules TARGET_YEAR=$TARGET_YEAR TARGET_MONTH=$TARGET_MONTH \
     node -r /app/node_modules/ts-node/register prisma/inspect-recent-transactions.ts --limit=30"
fi

EXEC_FLAG=""
if [ "$APPLY" = "1" ] || [ "$APPLY" = "yes" ] || [ "$APPLY" = "true" ]; then
  EXEC_FLAG="--execute"
  echo ""
  echo "!!! APPLY_FIXES=1 — writing to DB !!!"
else
  echo ""
  echo "(Dry-run only. Set APPLY_FIXES=1 to run clear + heal with --execute after backup.)"
fi

echo ""
echo "--- 4) clear-early-month-income-effective-date ---"
docker compose exec -T backend sh -lc \
  "cd $BACKEND_DIR && NODE_PATH=/app/node_modules \
   BANK_YEAR=$BANK_YEAR BANK_MONTH=$BANK_MONTH \
   node -r /app/node_modules/ts-node/register prisma/clear-early-month-income-effective-date.ts $EXEC_FLAG"

echo ""
echo "--- 5) heal-transaction-date-from-scraper-raw ---"
docker compose exec -T backend sh -lc \
  "cd $BACKEND_DIR && NODE_PATH=/app/node_modules \
   BANK_YEAR=$BANK_YEAR BANK_MONTH=$BANK_MONTH \
   node -r /app/node_modules/ts-node/register prisma/heal-transaction-date-from-scraper-raw.ts $EXEC_FLAG"

echo ""
echo "=== done ==="
