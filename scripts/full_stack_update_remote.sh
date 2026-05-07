#!/usr/bin/env bash
# עטיפה לפריסה מלאה — ראו scripts/deploy_remote_guest.sh (כולל prisma migrate).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/deploy_remote_guest.sh"
