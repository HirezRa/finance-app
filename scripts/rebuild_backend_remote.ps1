$ErrorActionPreference = "Stop"

if (-not $env:FINANCE_HYPERVISOR_SSH) { throw "Set FINANCE_HYPERVISOR_SSH" }
if (-not $env:FINANCE_GUEST_VMID) { throw "Set FINANCE_GUEST_VMID" }

$projectOnGuest = if ($env:FINANCE_PROJECT_ON_GUEST) { $env:FINANCE_PROJECT_ON_GUEST } else { "/opt/finance-app" }

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

$guest = "cd $projectOnGuest && git pull && docker compose build --no-cache backend && docker compose down --remove-orphans && docker compose up -d && sleep 8 && curl -s --max-time 10 --connect-timeout 5 http://localhost/api/v1/health"
$remote = "timeout 2400 bash -c 'pct exec $($env:FINANCE_GUEST_VMID) -- timeout 2300 bash -c `"$guest`"'"

Invoke-SshChecked -Arguments (@($sshOptions + @($env:FINANCE_HYPERVISOR_SSH, $remote)))
