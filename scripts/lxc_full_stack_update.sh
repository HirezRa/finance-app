#!/usr/bin/env bash
# עטיפה לפריסה מלאה — ראו scripts/deploy_to_lxc.sh (כולל prisma migrate).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/deploy_to_lxc.sh"
