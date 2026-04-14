#!/usr/bin/env bash
# Deploy finance-app to LXC 115 via Proxmox (192.168.1.181).
# Run from Git Bash: chmod +x scripts/deploy_to_lxc.sh && ./scripts/deploy_to_lxc.sh
set -euo pipefail

PROXMOX="root@192.168.1.181"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=no
)

# Run a command inside LXC 115 (guest). Outer timeout on Proxmox host; inner on guest.
# guest_cmd must not contain double quotes (use single quotes inside if needed).
lxc_run() {
  local outer_timeout="$1"
  local inner_timeout="$2"
  local guest_cmd="$3"
  ssh "${SSH_OPTS[@]}" "${PROXMOX}" \
    "timeout ${outer_timeout} bash -c 'pct exec 115 -- timeout ${inner_timeout} bash -lc \"${guest_cmd}\"'"
}

echo "=== Deploying to LXC 115 ==="

echo "[1/5] git pull"
lxc_run 120 90 "cd /opt/finance-app && git pull"

echo "[2/5] prisma migrate deploy"
lxc_run 180 120 "cd /opt/finance-app && docker compose exec -T backend npx prisma migrate deploy"

echo "[3/5] docker compose build backend (no cache)"
lxc_run 900 840 "cd /opt/finance-app && docker compose build --no-cache backend"

echo "[4/5] docker compose build frontend (no cache)"
lxc_run 900 840 "cd /opt/finance-app && docker compose build --no-cache frontend"

echo "[5/5] docker compose up -d"
lxc_run 180 120 "cd /opt/finance-app && docker compose down --remove-orphans && docker compose up -d"

echo "[health] waiting then GET /api/v1/health"
lxc_run 60 45 "sleep 10 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health"

echo "=== Deploy Complete ==="
