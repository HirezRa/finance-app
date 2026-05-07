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

$inner = "cd $projectOnGuest && docker compose exec -T backend npx ts-node prisma/fix-split-bills-category.ts"
$remote = "timeout 180 bash -c 'pct exec $($env:FINANCE_GUEST_VMID) -- timeout 120 bash -c `"$inner`"'"

Invoke-SshChecked -Arguments (@($sshOptions + @($env:FINANCE_HYPERVISOR_SSH, $remote)))
