#Requires -Version 5.1
<#
  Full remote deploy over SSH — same behavior as deploy_remote_guest.sh (PowerShell host).

  Environment:
    FINANCE_HYPERVISOR_SSH  (required) e.g. root@hypervisor
    FINANCE_GUEST_VMID      (required in guest-exec mode) Proxmox CT/VM id
    FINANCE_PROJECT_ON_GUEST  optional, default /opt/finance-app
    FINANCE_DEPLOY_VIA_PCT  optional; false or 0 = SSH straight to Docker host (no pct)
    FINANCE_SSH_STRICT_HOST_KEY_CHECKING  optional; default accept-new

  See: docs/DEPLOYMENT.md, .github/auto-deploy-setup.md
#>
$ErrorActionPreference = "Stop"

if (-not $env:FINANCE_HYPERVISOR_SSH) { throw "Set FINANCE_HYPERVISOR_SSH" }

$projectOnGuest = if ($env:FINANCE_PROJECT_ON_GUEST) { $env:FINANCE_PROJECT_ON_GUEST } else { "/opt/finance-app" }
$viaPct = -not (
  $env:FINANCE_DEPLOY_VIA_PCT -eq "false" -or
  $env:FINANCE_DEPLOY_VIA_PCT -eq "0"
)

if ($viaPct -and -not $env:FINANCE_GUEST_VMID) {
  throw "Set FINANCE_GUEST_VMID for guest-exec mode, or set FINANCE_DEPLOY_VIA_PCT=false"
}

$sshStrict = if ($env:FINANCE_SSH_STRICT_HOST_KEY_CHECKING) {
  $env:FINANCE_SSH_STRICT_HOST_KEY_CHECKING
} else {
  "accept-new"
}

$sshOptions = @(
  "-F", "/dev/null",
  "-o", "ConnectTimeout=15",
  "-o", "ServerAliveInterval=5",
  "-o", "ServerAliveCountMax=2",
  "-o", "StrictHostKeyChecking=$sshStrict"
)

function Invoke-SshChecked {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )
  & ssh @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "ssh command failed with exit code $LASTEXITCODE"
  }
}

$guest = "cd $projectOnGuest && git fetch origin main && git checkout -B main origin/main && git reset --hard origin/main && (docker compose exec -T backend npx prisma migrate deploy || true) && docker compose build --no-cache backend frontend nginx && docker compose down --remove-orphans && docker compose up -d && sleep 10 && curl -sf --max-time 30 --connect-timeout 5 http://localhost/api/v1/health"

if (-not $viaPct) {
  $remote = "timeout 3600 bash -c `"$guest`""
} else {
  $remote = "timeout 3600 bash -c 'pct exec $($env:FINANCE_GUEST_VMID) -- timeout 3500 bash -c `"$guest`"'"
}

Invoke-SshChecked -Arguments (@($sshOptions + @($env:FINANCE_HYPERVISOR_SSH, $remote)))
