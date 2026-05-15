#!/usr/bin/env sh
# רצף בדיקות + dry-run לריפוי משכורות/תאריכים — על המארח (לא בתוך הקונטיינר).
# הוא מריץ `docker compose exec backend ...`.
#
# מכל מיקום (גם root@...:~#):
#   sh /opt/finance-app/scripts/finance-salary-checks.sh
#
# אחרי עדכון קוד:
#   cd /opt/finance-app && git pull
#
# ביצוע אמיתי ב-DB (אחרי גיבוי!):
#   APPLY_FIXES=1 sh /opt/finance-app/scripts/finance-salary-checks.sh
#
set -e

# שורש הריפו: FINANCE_REPO_ROOT, או הורה של תיקיית הסקריפט אם הופעל בנתיב מוחלט, או /opt/finance-app
case "$0" in
  /*)
    _SCRIPT_DIR="${0%/*}"
    _PARENT="$(cd "$_SCRIPT_DIR/.." && pwd)"
    if [ -f "$_PARENT/docker-compose.yml" ]; then
      REPO_ROOT="${FINANCE_REPO_ROOT:-$_PARENT}"
    else
      REPO_ROOT="${FINANCE_REPO_ROOT:-/opt/finance-app}"
    fi
    ;;
  *)
    REPO_ROOT="${FINANCE_REPO_ROOT:-/opt/finance-app}"
    ;;
esac

BACKEND_DIR="$REPO_ROOT/backend"
export TARGET_YEAR="${TARGET_YEAR:-2026}"
export TARGET_MONTH="${TARGET_MONTH:-5}"
export BANK_YEAR="${BANK_YEAR:-$TARGET_YEAR}"
export BANK_MONTH="${BANK_MONTH:-$TARGET_MONTH}"
APPLY="${APPLY_FIXES:-0}"

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

cd "$REPO_ROOT" || {
  echo "ERROR: cd $REPO_ROOT failed — set FINANCE_REPO_ROOT or clone to /opt/finance-app" >&2
  exit 1
}

if [ ! -f docker-compose.yml ]; then
  echo "ERROR: docker-compose.yml not found in $REPO_ROOT" >&2
  exit 1
fi

if [ ! -d "$BACKEND_DIR" ]; then
  echo "ERROR: backend dir missing: $BACKEND_DIR" >&2
  exit 1
fi

echo "=== finance-salary-checks (repo=$REPO_ROOT, YEAR=$TARGET_YEAR MONTH=$TARGET_MONTH) ==="

echo ""
echo "--- 1) docker compose ps (backend) ---"
docker_compose ps backend 2>/dev/null || docker_compose ps 2>/dev/null || true

echo ""
echo "--- 2) health ---"
docker_compose exec -T backend sh -lc \
  'node -e "require(\"http\").get(\"http://localhost:\"+(process.env.PORT||3000)+\"/api/v1/health\",r=>{let b=\"\";r.on(\"data\",d=>b+=d);r.on(\"end\",()=>{console.log(r.statusCode,b.slice(0,200));process.exit(r.statusCode===200?0:1);});}).on(\"error\",e=>{console.error(e);process.exit(1);});"' \
  || echo "WARN: health check failed"

echo ""
echo "--- 3) inspect-recent-transactions (no DB writes) ---"
if [ -f "$REPO_ROOT/scripts/inspect-recent-txns-docker.sh" ]; then
  docker_compose exec -T backend sh "$REPO_ROOT/scripts/inspect-recent-txns-docker.sh" -- --limit=30
else
  docker_compose exec -T backend sh -lc \
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
docker_compose exec -T backend sh -lc \
  "cd $BACKEND_DIR && NODE_PATH=/app/node_modules \
   BANK_YEAR=$BANK_YEAR BANK_MONTH=$BANK_MONTH \
   node -r /app/node_modules/ts-node/register prisma/clear-early-month-income-effective-date.ts $EXEC_FLAG"

echo ""
echo "--- 5) heal-transaction-date-from-scraper-raw ---"
docker_compose exec -T backend sh -lc \
  "cd $BACKEND_DIR && NODE_PATH=/app/node_modules \
   BANK_YEAR=$BANK_YEAR BANK_MONTH=$BANK_MONTH \
   node -r /app/node_modules/ts-node/register prisma/heal-transaction-date-from-scraper-raw.ts $EXEC_FLAG"

echo ""
echo "=== done ==="
