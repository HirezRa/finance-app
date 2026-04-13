#!/bin/sh
# Self-update: git sync + docker compose build/up (runs in backend container with mounted APP_DIR + docker.sock)
set -eu

APP_DIR="${APP_DIR:-/opt/finance-app}"
STATUS_FILE="${UPDATE_STATUS_FILE:-/tmp/finance-app-update-status.json}"
LOCK_FILE="${UPDATE_LOCK_FILE:-/tmp/finance-app-update.lock}"
# לוג בעדיפות תחת APP_DIR/logs (נראה מההוסט כשהריפו ממורכב); אחרת /tmp בתוך הקונטיינר
if [ -n "${UPDATE_LOG_FILE:-}" ]; then
  LOG_FILE="$UPDATE_LOG_FILE"
elif mkdir -p "$APP_DIR/logs" 2>/dev/null && touch "$APP_DIR/logs/.wtest" 2>/dev/null && rm -f "$APP_DIR/logs/.wtest" 2>/dev/null; then
  LOG_FILE="$APP_DIR/logs/self-update.log"
else
  LOG_FILE="/tmp/finance-app-update.log"
fi

START_TS=$(date +%s)
export STATUS_FILE

write_status() {
  WS_IN="$1"
  WS_ST="$2"
  WS_MSG="$3"
  WS_PT="$4"
  WS_ERR="${5:-}"
  export WS_IN WS_ST WS_MSG WS_PT WS_ERR
  node -e "
    const fs = require('fs');
    const o = {
      inProgress: process.env.WS_IN === '1',
      stage: process.env.WS_ST,
      message: process.env.WS_MSG || '',
      progress: Number(process.env.WS_PT || '0'),
      updatedAt: new Date().toISOString(),
    };
    if (process.env.WS_ERR) o.error = process.env.WS_ERR;
    fs.writeFileSync(process.env.STATUS_FILE, JSON.stringify(o));
  "
}

# $1 = level (INFO|WARN|ERROR), remainder = message
log_line() {
  _lvl="$1"
  shift
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [${_lvl}] $*" | tee -a "$LOG_FILE"
}

if [ -f "$LOCK_FILE" ]; then
  log_line WARN "עדכון כבר מתבצע (lock קיים) — יוצא"
  exit 1
fi

touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

VER_BEFORE="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo '?')"
log_line INFO "========================================="
log_line INFO "=== תחילת self-update (סקריפט) ==="
log_line INFO "========================================="
log_line INFO "תיקייה: $APP_DIR | גרסה לפני: $VER_BEFORE"
write_status 1 starting "מתחיל עדכון..." 5

cd "$APP_DIR" || {
  write_status 0 failed "תיקיית האפליקציה לא נמצאה" 0 "cd failed"
  log_line ERROR "cd ל-APP_DIR נכשל: $APP_DIR"
  exit 1
}

write_status 1 pulling "מוריד קוד מ-GitHub (git fetch)..." 15
log_line INFO "שלב 1a/4: git fetch origin"
if ! git fetch origin >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת git fetch" 0 "git fetch failed"
  log_line ERROR "git fetch נכשל — ראה שורות למעלה בלוג"
  exit 1
fi
log_line INFO "שלב 1a: git fetch הצליח"

log_line INFO "שלב 1b/4: git reset --hard origin/main"
if ! git reset --hard origin/main >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת git reset" 0 "git reset failed"
  log_line ERROR "git reset נכשל"
  exit 1
fi
VER_AFTER="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo '?')"
log_line INFO "שלב 1b: reset הושלם | גרסה אחרי סנכרון קוד: $VER_AFTER"

write_status 1 building "בונה קונטיינרים (עשוי להימשך מספר דקות)..." 40
log_line INFO "שלב 2/4: docker compose build --no-cache backend frontend"
if ! docker compose build --no-cache backend frontend >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת docker build" 0 "docker compose build failed"
  log_line ERROR "docker compose build נכשל"
  exit 1
fi
log_line INFO "שלב 2: build הושלם"

write_status 1 restarting "מפעיל מחדש שירותים..." 85
log_line INFO "שלב 3/4: docker compose up -d"
if ! docker compose up -d >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת docker up" 0 "docker compose up failed"
  log_line ERROR "docker compose up נכשל"
  exit 1
fi
log_line INFO "שלב 3: up -d הושלם"

write_status 1 nginx "מרענן nginx..." 93
log_line INFO "שלב 4/4: docker compose restart nginx (אופציונלי)"
docker compose restart nginx >>"$LOG_FILE" 2>&1 || log_line WARN "restart nginx נכשל או לא רלוונטי — ממשיכים"

END_TS=$(date +%s)
DUR=$((END_TS - START_TS))
log_line INFO "========================================="
log_line INFO "=== עדכון הושלם בהצלחה | משך כולל: ${DUR}s | גרסה: $VER_AFTER ==="
log_line INFO "========================================="
write_status 0 done "העדכון הושלם. מומלץ לרענן את הדף." 100
