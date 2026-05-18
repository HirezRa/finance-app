#!/usr/bin/env bash
# Full remote deploy: SSH to management host, then run stack update on the guest (default: pct exec),
# or SSH directly to the Docker host when FINANCE_DEPLOY_VIA_PCT=false.
#
# Required: FINANCE_HYPERVISOR_SSH (e.g. user@hypervisor)
# Guest-exec mode (default): FINANCE_GUEST_VMID; optional FINANCE_PROJECT_ON_GUEST (default /opt/finance-app)
# Direct mode: FINANCE_DEPLOY_VIA_PCT=false — no pct; SSH session is the Docker host.
#
# Optional: FINANCE_SSH_STRICT_HOST_KEY_CHECKING (default accept-new). Use "no" only in trusted lab networks.
#
# See: docs/DEPLOYMENT.md, .github/auto-deploy-setup.md, .github/workflows/deploy-remote.yml
set -euo pipefail

: "${FINANCE_HYPERVISOR_SSH:?Set FINANCE_HYPERVISOR_SSH}"

PROJ="${FINANCE_PROJECT_ON_GUEST:-/opt/finance-app}"
VIA_PCT="${FINANCE_DEPLOY_VIA_PCT:-true}"
SSH_STRICT="${FINANCE_SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"

if [[ "$VIA_PCT" != "false" && "$VIA_PCT" != "0" ]]; then
  : "${FINANCE_GUEST_VMID:?Set FINANCE_GUEST_VMID for guest-exec mode, or set FINANCE_DEPLOY_VIA_PCT=false}"
fi

SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o "StrictHostKeyChecking=${SSH_STRICT}"
)

# Align with safe-update / CI docs: pull main, migrate (best-effort), rebuild images, up, health.
GUEST="cd ${PROJ} && git fetch origin main && git checkout -B main origin/main && git reset --hard origin/main && (docker compose exec -T backend npx prisma migrate deploy || true) && docker compose build --no-cache backend frontend nginx && docker compose down --remove-orphans && docker compose up -d && sleep 10 && curl -sf --max-time 30 --connect-timeout 5 http://localhost/api/v1/health"

if [[ "$VIA_PCT" == "false" || "$VIA_PCT" == "0" ]]; then
  exec ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
    "timeout 3600 bash -c \"${GUEST}\""
else
  exec ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
    "timeout 3600 bash -c 'pct exec ${FINANCE_GUEST_VMID} -- timeout 3500 bash -c \"${GUEST}\"'"
fi
