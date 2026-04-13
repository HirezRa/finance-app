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

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" | tee -a "$LOG_FILE"
}

if [ -f "$LOCK_FILE" ]; then
  log "Lock exists, abort"
  exit 1
fi

touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

log "Starting self-update"
write_status 1 starting "מתחיל עדכון..." 5

cd "$APP_DIR" || {
  write_status 0 failed "תיקיית האפליקציה לא נמצאה" 0 "cd failed"
  exit 1
}

write_status 1 pulling "מוריד קוד מ-GitHub..." 15
if ! git fetch origin >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת git fetch" 0 "git fetch failed"
  exit 1
fi
if ! git reset --hard origin/main >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת git reset" 0 "git reset failed"
  exit 1
fi

write_status 1 building "בונה קונטיינרים (עשוי להימשך מספר דקות)..." 40
if ! docker compose build --no-cache backend frontend >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת docker build" 0 "docker compose build failed"
  exit 1
fi

write_status 1 restarting "מפעיל מחדש שירותים..." 85
if ! docker compose up -d >>"$LOG_FILE" 2>&1; then
  write_status 0 failed "שגיאת docker up" 0 "docker compose up failed"
  exit 1
fi

write_status 1 nginx "מרענן nginx..." 93
docker compose restart nginx >>"$LOG_FILE" 2>&1 || true

log "Update completed successfully"
write_status 0 done "העדכון הושלם. מומלץ לרענן את הדף." 100
