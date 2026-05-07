$ErrorActionPreference = "Stop"

if (-not $env:FINANCE_HYPERVISOR_SSH) { throw "Set FINANCE_HYPERVISOR_SSH" }

# true (default): SSH to Proxmox host, then pct exec VMID (needs FINANCE_GUEST_VMID).
# false: SSH directly to the machine running Docker (CT/LXC IP) — no pct on that host.
$viaPct = ($env:FINANCE_DEPLOY_VIA_PCT -ne 'false')
if ($viaPct -and -not $env:FINANCE_GUEST_VMID) { throw "Set FINANCE_GUEST_VMID (or set FINANCE_DEPLOY_VIA_PCT=false for direct SSH to Docker host)" }
if (-not $viaPct) {
  Write-Host "Mode: direct SSH to Docker host (FINANCE_DEPLOY_VIA_PCT=false). pct is not used."
}

$projectOnGuest = if ($env:FINANCE_PROJECT_ON_GUEST) { $env:FINANCE_PROJECT_ON_GUEST } else { "/opt/finance-app" }
Write-Host "Remote project dir: $projectOnGuest (override with `$env:FINANCE_PROJECT_ON_GUEST)"

$sshOptions = @(
  "-F", "/dev/null",
  "-o", "ConnectTimeout=15",
  "-o", "ServerAliveInterval=5",
  "-o", "ServerAliveCountMax=2",
  "-o", "StrictHostKeyChecking=no"
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

function Invoke-GuestCommand {
  param(
    [int]$OuterTimeout,
    [int]$InnerTimeout,
    [string]$GuestCommand
  )

  if ($viaPct) {
    $remote = "timeout $OuterTimeout bash -c 'pct exec $($env:FINANCE_GUEST_VMID) -- timeout $InnerTimeout bash -lc `"$GuestCommand`"'"
  } else {
    $remote = "timeout $OuterTimeout bash -lc `"$GuestCommand`""
  }
  Invoke-SshChecked -Arguments (@($sshOptions + @($env:FINANCE_HYPERVISOR_SSH, $remote)))
}

if ($viaPct) {
  Write-Host "=== Deploying via pct (guest VMID $($env:FINANCE_GUEST_VMID)) ==="
} else {
  Write-Host "=== Deploying (direct SSH to $($env:FINANCE_HYPERVISOR_SSH)) ==="
}
Write-Host "[1/5] git pull"
# Avoid nested quotes (breaks pct exec wrapping); message is still clear.
$gitPull = "cd $projectOnGuest && git rev-parse --git-dir >/dev/null 2>&1 || { echo DEPLOY_NOT_GIT_REPO path=$projectOnGuest hint=clone_or_set_FINANCE_PROJECT_ON_GUEST; exit 1; } && git pull"
Invoke-GuestCommand -OuterTimeout 120 -InnerTimeout 90 -GuestCommand $gitPull

Write-Host "[2/5] prisma migrate deploy"
Invoke-GuestCommand -OuterTimeout 180 -InnerTimeout 120 -GuestCommand "cd $projectOnGuest && docker compose exec -T backend npx prisma migrate deploy"

Write-Host "[3/5] docker compose build backend (no cache)"
Invoke-GuestCommand -OuterTimeout 900 -InnerTimeout 840 -GuestCommand "cd $projectOnGuest && docker compose build --no-cache backend"

Write-Host "[4/5] docker compose build frontend (no cache)"
Invoke-GuestCommand -OuterTimeout 900 -InnerTimeout 840 -GuestCommand "cd $projectOnGuest && docker compose build --no-cache frontend"

Write-Host "[5/5] docker compose up -d"
Invoke-GuestCommand -OuterTimeout 180 -InnerTimeout 120 -GuestCommand "cd $projectOnGuest && docker compose down --remove-orphans && docker compose up -d"

Write-Host "[health] waiting then GET /api/v1/health"
Invoke-GuestCommand -OuterTimeout 60 -InnerTimeout 45 -GuestCommand "sleep 10 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health"

Write-Host "=== Deploy Complete ==="
