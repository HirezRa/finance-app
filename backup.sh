#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/opt/finance-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/finance_backup_${DATE}.sql"
mkdir -p "$BACKUP_DIR"
docker exec finance-db pg_dump -U finance finance_app > "$BACKUP_FILE"
gzip "$BACKUP_FILE"
find "$BACKUP_DIR" -name "*.gz" -mtime +14 -delete
