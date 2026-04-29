#!/bin/bash
# Finance App - Safe Update Script with Rollback

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/finance-app}"
UPDATE_DATA_DIR="${UPDATE_DATA_DIR:-$APP_DIR/update-data}"
TRIGGER_FILE="$UPDATE_DATA_DIR/.update-requested"
STATUS_FILE="$UPDATE_DATA_DIR/.update-status.json"
HISTORY_FILE="$UPDATE_DATA_DIR/.update-history.json"
BUILD_LOG_FILE="$UPDATE_DATA_DIR/build.log"
LOG_FILE="$APP_DIR/logs/update.log"
BACKUP_DIR="$APP_DIR/backups"
# Health via nginx on host :80 (backend is not published on host :3000).
# Override: HEALTH_CHECK_URL / HEALTH_CHECK_RETRIES / HEALTH_CHECK_INTERVAL
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-2}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://127.0.0.1/api/v1/health}"

mkdir -p "$APP_DIR/logs" "$BACKUP_DIR"

ensure_update_dir() {
  mkdir -p "$UPDATE_DATA_DIR"
  chmod 777 "$UPDATE_DATA_DIR" 2>/dev/null || true
  touch "$STATUS_FILE" "$HISTORY_FILE" "$BUILD_LOG_FILE" 2>/dev/null || true
  chmod 666 "$STATUS_FILE" "$HISTORY_FILE" "$BUILD_LOG_FILE" 2>/dev/null || true
}

ensure_update_dir

log(){
  local ts
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$ts] $1" | tee -a "$LOG_FILE"
}

log_info() {
  log "[INFO] $*"
}

log_error() {
  log "[ERROR] $*"
}

esc(){
  echo "$1" | sed 's/"/\\"/g'
}

current_version(){
  cat "$APP_DIR/VERSION" 2>/dev/null || echo "0.0.0"
}

target_version(){
  if [ -f "$TRIGGER_FILE" ]; then
    grep -oE '"targetVersion"\s*:\s*"[^"]+"' "$TRIGGER_FILE" | sed -E 's/.*"([^"]+)"/\1/' || true
  fi
}

write_status(){
  local st="$1"
  local msg="$2"
  local progress="${3:-0}"
  local err="${4:-}"
  local cur
  cur=$(current_version | tr -d '\n')
  local tgt
  tgt=$(target_version | tr -d '\n')
  ensure_update_dir
  {
    echo "{"
    echo "  \"status\": \"$st\","
    echo "  \"message\": \"$(esc "$msg")\","
    echo "  \"currentVersion\": \"$cur\","
    if [ -n "$tgt" ]; then
      echo "  \"targetVersion\": \"$tgt\","
    fi
    echo "  \"progress\": $progress,"
    if [ -n "$err" ]; then
      echo "  \"error\": \"$(esc "$err")\","
    fi
    echo "  \"updatedAt\": \"$(date -Iseconds)\""
    echo "}"
  } > "$STATUS_FILE"
  chmod 666 "$STATUS_FILE" 2>/dev/null || true
}

append_history(){
  local st="$1"
  local err="${2:-}"
  local prev="$3"
  local newv="$4"
  local start_ts="$5"
  local end_ts
  end_ts=$(date +%s)
  local duration=$((end_ts - start_ts))
  local status_word="success"
  if [ "$st" = "rolled-back" ]; then
    status_word="rolled-back"
  elif [ "$st" = "failed" ]; then
    status_word="failed"
  fi

  local entry
  entry="{\"version\":\"$newv\",\"previousVersion\":\"$prev\",\"timestamp\":\"$(date -Iseconds)\",\"status\":\"$status_word\",\"duration\":$duration"
  if [ -n "$err" ]; then
    entry="$entry,\"error\":\"$(esc "$err")\""
  fi
  entry="$entry}"

  ensure_update_dir
  if [ ! -f "$HISTORY_FILE" ] || [ ! -s "$HISTORY_FILE" ]; then
    echo "[$entry]" > "$HISTORY_FILE"
    chmod 666 "$HISTORY_FILE" 2>/dev/null || true
    return 0
  fi

  if grep -q '^\[' "$HISTORY_FILE"; then
    local content
    content=$(cat "$HISTORY_FILE")
    content=${content%]}
    if [ "$content" = "[" ]; then
      echo "[$entry]" > "$HISTORY_FILE"
    else
      echo "$content,$entry]" > "$HISTORY_FILE"
    fi
  else
    echo "$entry" >> "$HISTORY_FILE"
  fi
  chmod 666 "$HISTORY_FILE" 2>/dev/null || true
}

create_backup(){
  local name
  name="backup-$(date +%Y%m%d-%H%M%S)"
  local path="$BACKUP_DIR/$name"
  mkdir -p "$path"
  cp "$APP_DIR/VERSION" "$path/" 2>/dev/null || true
  docker save finance-app-backend:latest -o "$path/backend-image.tar" 2>/dev/null || true
  docker save finance-app-frontend:latest -o "$path/frontend-image.tar" 2>/dev/null || true
  (cd "$APP_DIR" && git rev-parse HEAD > "$path/commit-hash") || true
  echo "$name" > /tmp/finance_update_backup_name
  log "[INFO] backup created: $name"
}

rollback(){
  local reason="$1"
  local name
  name=$(cat /tmp/finance_update_backup_name 2>/dev/null || true)
  if [ -z "$name" ] || [ ! -d "$BACKUP_DIR/$name" ]; then
    log "[ERROR] rollback unavailable (no backup): $reason"
    write_status "failed" "העדכון נכשל ולא ניתן לבצע rollback" 100 "$reason"
    return 1
  fi
  local path="$BACKUP_DIR/$name"
  write_status "in-progress" "מבצע rollback..." 90 "$reason"
  if [ -f "$path/commit-hash" ]; then
    (cd "$APP_DIR" && git checkout "$(cat "$path/commit-hash")" --force) || true
  fi
  [ -f "$path/backend-image.tar" ] && docker load -i "$path/backend-image.tar" >/dev/null 2>&1 || true
  [ -f "$path/frontend-image.tar" ] && docker load -i "$path/frontend-image.tar" >/dev/null 2>&1 || true
  (cd "$APP_DIR" && docker compose up -d) || true
  write_status "rolled-back" "בוצע rollback לגרסה קודמת" 100 "$reason"
  log "[WARN] rollback completed"
}

check_health() {
  log_info "בודק תקינות: $HEALTH_CHECK_URL"

  local retries=0
  while [ "$retries" -lt "$HEALTH_CHECK_RETRIES" ]; do
    if curl -sf "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
      log_info "בדיקת תקינות עברה בהצלחה"
      return 0
    fi

    retries=$((retries + 1))
    log_info "ממתין לשרת... ($retries/$HEALTH_CHECK_RETRIES)"
    sleep "$HEALTH_CHECK_INTERVAL"
  done

  log_error "בדיקת תקינות נכשלה אחרי $HEALTH_CHECK_RETRIES ניסיונות"
  return 1
}

build_containers() {
  log "[INFO] building containers..."
  write_status "in-progress" "בונה backend..." 50

  cd "$APP_DIR"
  : > "$BUILD_LOG_FILE"
  chmod 666 "$BUILD_LOG_FILE" 2>/dev/null || true

  log "[INFO] building backend..."
  if ! docker compose build --no-cache --progress=plain backend 2>&1 | tee -a "$BUILD_LOG_FILE" "$LOG_FILE"; then
    log "[ERROR] backend build failed"
    return 1
  fi

  write_status "in-progress" "בונה frontend..." 65

  log "[INFO] building frontend..."
  if ! docker compose build --no-cache --progress=plain frontend 2>&1 | tee -a "$BUILD_LOG_FILE" "$LOG_FILE"; then
    log "[ERROR] frontend build failed"
    return 1
  fi

  log "[INFO] build completed"
  return 0
}

cleanup(){
  rm -f "$TRIGGER_FILE" /tmp/finance_update_backup_name
  ls -dt "$BACKUP_DIR"/backup-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true
  docker system prune -f >/dev/null 2>&1 || true
}

main(){
  if [ ! -f "$TRIGGER_FILE" ]; then
    log "[ERROR] trigger file not found"
    exit 1
  fi

  local start_ts
  start_ts=$(date +%s)
  local previous_version
  previous_version=$(current_version | tr -d '\n')

  write_status "in-progress" "מתחיל עדכון..." 5
  create_backup || { write_status "failed" "יצירת גיבוי נכשלה" 100 "backup failed"; cleanup; exit 1; }

  write_status "in-progress" "מושך עדכונים..." 20
  (cd "$APP_DIR" && git fetch origin main && git checkout main --force && git pull origin main) || {
    rollback "משיכת עדכונים נכשלה"
    append_history "rolled-back" "Git pull failed" "$previous_version" "$previous_version" "$start_ts"
    cleanup
    exit 1
  }

  write_status "in-progress" "מעדכן מסד נתונים..." 40
  (cd "$APP_DIR" && docker compose exec -T backend npx prisma migrate deploy) || true

  write_status "in-progress" "בונה קונטיינרים..." 55
  if ! build_containers; then
    rollback "בנייה נכשלה"
    append_history "rolled-back" "Build failed" "$previous_version" "$previous_version" "$start_ts"
    cleanup
    exit 1
  fi

  write_status "in-progress" "מפעיל קונטיינרים מחדש..." 80
  (cd "$APP_DIR" && docker compose up -d) || {
    rollback "הפעלה מחדש נכשלה"
    append_history "rolled-back" "Restart failed" "$previous_version" "$previous_version" "$start_ts"
    cleanup
    exit 1
  }

  write_status "in-progress" "בודק תקינות..." 90
  if ! check_health; then
    rollback "בדיקת תקינות נכשלה"
    append_history "rolled-back" "Health check failed" "$previous_version" "$previous_version" "$start_ts"
    cleanup
    exit 1
  fi

  local new_version
  new_version=$(current_version | tr -d '\n')
  write_status "completed" "העדכון הושלם בהצלחה!" 100
  append_history "success" "" "$previous_version" "$new_version" "$start_ts"

  log "[INFO] update completed: $previous_version -> $new_version"
  cleanup
}

main "$@"
