#!/usr/bin/env bash
# Run prisma/fix-split-bills-category.ts inside the backend container on a remote Linux guest.
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
INNER="cd ${PROJ} && docker compose exec -T backend npx ts-node prisma/fix-split-bills-category.ts"
ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
  "timeout 180 bash -c 'pct exec ${FINANCE_GUEST_VMID} -- timeout 120 bash -c \"${INNER}\"'"
