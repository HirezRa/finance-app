#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$0")"
BACKUP_DIR="$ROOT/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/finance_backup_${DATE}.sql"
mkdir -p "$BACKUP_DIR"
docker exec finance-db pg_dump -U finance finance_app > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
find "$BACKUP_DIR" -name "*.gz" -mtime +14 -delete
