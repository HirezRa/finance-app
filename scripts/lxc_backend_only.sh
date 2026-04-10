#!/usr/bin/env bash
set -euo pipefail
PROXMOX="root@192.168.1.181"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=no
)
GUEST='cd /opt/finance-app && git pull && docker compose build --no-cache backend && docker compose down --remove-orphans && docker compose up -d && sleep 8 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health'
ssh "${SSH_OPTS[@]}" "${PROXMOX}" \
  "timeout 2400 bash -c 'pct exec 115 -- timeout 2300 bash -c \"${GUEST}\"'"
