#!/usr/bin/env bash
# Pull Ollama model on LXC 104 via Proxmox host 192.168.1.181.
set -euo pipefail
PROXMOX="root@192.168.1.181"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o StrictHostKeyChecking=no
)
MODEL="${1:-qwen2.5:7b}"
GUEST="ollama pull ${MODEL}"
ssh "${SSH_OPTS[@]}" "${PROXMOX}" \
  "timeout 2400 bash -c 'pct exec 104 -- timeout 2300 bash -lc \"${GUEST}\"'"
