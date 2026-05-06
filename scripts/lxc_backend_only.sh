#!/usr/bin/env bash
# Remote backend rebuild: SSH to your hypervisor host, then run commands inside a Linux guest (e.g. pct exec).
# Prerequisites: set environment variables (do not commit real values). See docs/DEPLOYMENT.md.
#   export FINANCE_HYPERVISOR_SSH='user@hypervisor.example'
#   export FINANCE_GUEST_VMID='XXX'
#   export FINANCE_PROJECT_ON_GUEST='/path/to/finance-app'   # optional
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
GUEST="cd ${PROJ} && git pull && docker compose build --no-cache backend && docker compose down --remove-orphans && docker compose up -d && sleep 8 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health"
ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
  "timeout 2400 bash -c 'pct exec ${FINANCE_GUEST_VMID} -- timeout 2300 bash -c \"${GUEST}\"'"
