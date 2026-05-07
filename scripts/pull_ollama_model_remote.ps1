$ErrorActionPreference = "Stop"

if (-not $env:FINANCE_HYPERVISOR_SSH) { throw "Set FINANCE_HYPERVISOR_SSH" }
$vmid = if ($env:FINANCE_OLLAMA_GUEST_VMID) { $env:FINANCE_OLLAMA_GUEST_VMID } elseif ($env:FINANCE_GUEST_VMID) { $env:FINANCE_GUEST_VMID } else { throw "Set FINANCE_OLLAMA_GUEST_VMID or FINANCE_GUEST_VMID" }

$model = if ($args.Count -gt 0 -and $args[0]) { $args[0] } else { "qwen2.5:7b" }

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

$guest = "/usr/local/bin/ollama pull $model"
$remote = "timeout 2400 bash -c 'pct exec $vmid -- timeout 2300 bash -lc `"$guest`"'"

Invoke-SshChecked -Arguments (@($sshOptions + @($env:FINANCE_HYPERVISOR_SSH, $remote)))
