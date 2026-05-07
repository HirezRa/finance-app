#!/usr/bin/env bash
# Full deploy on a remote Linux guest application host.
#   Default: SSH to hypervisor, then exec into guest by VMID (FINANCE_GUEST_VMID).
#   Direct: FINANCE_DEPLOY_VIA_PCT=false → SSH straight to the Docker host (no guest-exec on that hop).
# Optional on the guest `.env`: SCRAPER_GIT_SHA, CHROMIUM_VERSION (see LOGGING_GUIDE.md).
#   export FINANCE_HYPERVISOR_SSH='user@host'
#   export FINANCE_GUEST_VMID='XXX'   # required when using guest-exec mode
#   export FINANCE_PROJECT_ON_GUEST='/path/to/finance-app'   # optional
# Run: chmod +x scripts/deploy_remote_guest.sh && ./scripts/deploy_remote_guest.sh
set -euo pipefail
: "${FINANCE_HYPERVISOR_SSH:?Set FINANCE_HYPERVISOR_SSH}"
if [ "${FINANCE_DEPLOY_VIA_PCT:-true}" != "false" ]; then
  : "${FINANCE_GUEST_VMID:?Set FINANCE_GUEST_VMID (or set FINANCE_DEPLOY_VIA_PCT=false)}"
else
  echo "Mode: direct SSH to Docker host (FINANCE_DEPLOY_VIA_PCT=false)."
fi
PROJ="${FINANCE_PROJECT_ON_GUEST:-/opt/finance-app}"
echo "Remote project dir: ${PROJ} (override with FINANCE_PROJECT_ON_GUEST)"
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
  if [ "${FINANCE_DEPLOY_VIA_PCT:-true}" = "false" ]; then
    ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
      "timeout ${outer_timeout} bash -lc $(printf '%q' "$guest_cmd")"
  else
    ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
      "timeout ${outer_timeout} bash -c 'pct exec ${FINANCE_GUEST_VMID} -- timeout ${inner_timeout} bash -lc \"${guest_cmd}\"'"
  fi
}

if [ "${FINANCE_DEPLOY_VIA_PCT:-true}" = "false" ]; then
  echo "=== Deploying (direct SSH to ${FINANCE_HYPERVISOR_SSH}) ==="
else
  echo "=== Deploying (guest ${FINANCE_GUEST_VMID} via hypervisor exec) ==="
fi

echo "[1/5] git pull"
guest_run 120 90 "cd ${PROJ} && git rev-parse --git-dir >/dev/null 2>&1 || { echo DEPLOY_NOT_GIT_REPO path=${PROJ}; exit 1; } && git pull"

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
