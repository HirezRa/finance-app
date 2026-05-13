#!/usr/bin/env bash
# Pull an Ollama model on a remote Linux guest (via hypervisor SSH + guest exec).
#   export FINANCE_HYPERVISOR_SSH='user@hypervisor.example'
#   export FINANCE_OLLAMA_GUEST_VMID='XXX'   # or set FINANCE_GUEST_VMID
# Optional: FINANCE_GUEST_VMID used if FINANCE_OLLAMA_GUEST_VMID unset
set -euo pipefail
: "${FINANCE_HYPERVISOR_SSH:?Set FINANCE_HYPERVISOR_SSH}"
VMID="${FINANCE_OLLAMA_GUEST_VMID:-${FINANCE_GUEST_VMID:?Set FINANCE_OLLAMA_GUEST_VMID or FINANCE_GUEST_VMID}}"
SSH_STRICT="${FINANCE_SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_OPTS=(
  -F /dev/null
  -o ConnectTimeout=15
  -o ServerAliveInterval=5
  -o ServerAliveCountMax=2
  -o "StrictHostKeyChecking=${SSH_STRICT}"
)
MODEL="${1:-qwen2.5:7b}"
GUEST="/usr/local/bin/ollama pull ${MODEL}"
ssh "${SSH_OPTS[@]}" "${FINANCE_HYPERVISOR_SSH}" \
  "timeout 2400 bash -c 'pct exec ${VMID} -- timeout 2300 bash -lc \"${GUEST}\"'"
