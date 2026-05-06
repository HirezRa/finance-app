#!/usr/bin/env bash
# Full deploy on a remote Linux guest (hypervisor SSH + pct exec into guest running Docker).
#   export FINANCE_HYPERVISOR_SSH='user@hypervisor.example'
#   export FINANCE_GUEST_VMID='XXX'
#   export FINANCE_PROJECT_ON_GUEST='/path/to/finance-app'   # optional
# Run: chmod +x scripts/deploy_to_lxc.sh && ./scripts/deploy_to_lxc.sh
set -euo pipefail
: "${FINANCE_HYPERVISOR_SSH:?Set FINANCE_HYPERVISOR_SSH}"
: "${FINANCE_GUEST_VMID:?Set FINANCE_GUEST_VMID}"
PROJ="${FINANCE_PROJECT_ON_GUEST:-/opt/finance-app}"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=no
)

guest_run() {
  local outer_timeout="$1"
  local inner_timeout="$2"
  local guest_cmd="$3"
  ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
    "timeout ${outer_timeout} bash -c 'pct exec ${FINANCE_GUEST_VMID} -- timeout ${inner_timeout} bash -lc \"${guest_cmd}\"'"
}

echo "=== Deploying (guest ${FINANCE_GUEST_VMID}) ==="

echo "[1/5] git pull"
guest_run 120 90 "cd ${PROJ} && git pull"

echo "[2/5] prisma migrate deploy"
guest_run 180 120 "cd ${PROJ} && docker compose exec -T backend npx prisma migrate deploy"

echo "[3/5] docker compose build backend (no cache)"
guest_run 900 840 "cd ${PROJ} && docker compose build --no-cache backend"

echo "[4/5] docker compose build frontend (no cache)"
guest_run 900 840 "cd ${PROJ} && docker compose build --no-cache frontend"

echo "[5/5] docker compose up -d"
guest_run 180 120 "cd ${PROJ} && docker compose down --remove-orphans && docker compose up -d"

echo "[health] waiting then GET /api/v1/health"
guest_run 60 45 "sleep 10 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health"

echo "=== Deploy Complete ==="
