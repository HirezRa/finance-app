#!/usr/bin/env bash
# Run prisma/fix-split-bills-category.ts inside LXC 115 backend container (via Proxmox).
set -euo pipefail
PROXMOX="root@192.168.1.181"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=no
)
ssh "${SSH_OPTS[@]}" "${PROXMOX}" \
  "timeout 180 bash -c 'pct exec 115 -- timeout 120 bash -c \"cd /opt/finance-app && docker compose exec -T backend npx ts-node prisma/fix-split-bills-category.ts\"'"
