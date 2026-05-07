#Requires -Version 5.1
<#
  One-shot: upload GitHub Actions deploy secrets/variables for deploy-remote.yml.
  Requires: gh CLI logged in (gh auth login) with repo + workflow scope.

  Examples:
    Proxmox (pct): SSH host = hypervisor, GuestVmid = CT id
    .\scripts\push-github-deploy-settings.ps1 `
      -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519" `
      -SshHost "<REDACTED_LAN_1>" `
      -GuestVmid "115"

    Direct SSH to Docker/LXC IP (no pct on that host):
    .\scripts\push-github-deploy-settings.ps1 `
      -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519" `
      -SshHost "<REDACTED_LAN_197>" `
      -SshDirectToDockerHost

  Do not commit your private key.
#>
[CmdletBinding()]
param(
  [string] $Repo = "HirezRa/finance-app",
  [Parameter(Mandatory = $true)]
  [string] $SshKeyPath,
  [Parameter(Mandatory = $true)]
  [string] $SshHost,
  [string] $GuestVmid = "",
  [string] $SshUser = "root",
  [string] $ProjectPath = "/opt/finance-app",
  [switch] $AutoDeployOnPush,
  [switch] $SshDirectToDockerHost
)

if (-not $SshDirectToDockerHost -and [string]::IsNullOrWhiteSpace($GuestVmid)) {
  throw 'GuestVmid is required unless -SshDirectToDockerHost (SSH straight to machine running Docker).'
}

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'Install GitHub CLI: https://cli.github.com/ - then run: gh auth login'
}

$SshKeyPath = $SshKeyPath.Trim().Trim('"')
if ($SshKeyPath -match '\.\.\.') {
  throw @'
SshKeyPath must be the real path to your PRIVATE key file (do not copy "..." from examples).
Example:  -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519"
Or:       -SshKeyPath "C:\Users\You\.ssh\id_rsa"
'@
}

try {
  $resolved = (Resolve-Path -LiteralPath $SshKeyPath -ErrorAction Stop).ProviderPath
} catch {
  $hint = if (-not (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.ssh'))) {
    "`nFolder does not exist: $($env:USERPROFILE)\.ssh`nCreate a key: ssh-keygen -t ed25519 -f `"$($env:USERPROFILE)\.ssh\id_ed25519`""
  } else { '' }
  throw "SSH key path not found: $SshKeyPath$hint"
}

if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
  throw @"
-SshKeyPath must be a FILE (private key), not a directory.
You passed: $resolved
Example file names: id_ed25519, id_rsa, or a dedicated deploy key.
"@
}

Write-Host "Setting secret FINANCE_DEPLOY_SSH_KEY on $Repo ..."
Get-Content -LiteralPath $resolved -Raw | gh secret set FINANCE_DEPLOY_SSH_KEY -R $Repo
if ($LASTEXITCODE -ne 0) { throw "gh secret set failed" }

Write-Host "Setting variables on $Repo ..."
gh variable set FINANCE_DEPLOY_SSH_HOST -R $Repo -b $SshHost
gh variable set FINANCE_DEPLOY_SSH_USER -R $Repo -b $SshUser
gh variable set FINANCE_DEPLOY_PROJECT_PATH -R $Repo -b $ProjectPath
if ($SshDirectToDockerHost) {
  gh variable set FINANCE_DEPLOY_VIA_PCT -R $Repo -b "false"
  Write-Host "(FINANCE_DEPLOY_VIA_PCT=false: SSH target is the Docker host, not Proxmox pct.)"
} else {
  gh variable set FINANCE_DEPLOY_GUEST_VMID -R $Repo -b $GuestVmid
  gh variable set FINANCE_DEPLOY_VIA_PCT -R $Repo -b "true"
}
if ($AutoDeployOnPush) {
  gh variable set FINANCE_AUTO_DEPLOY -R $Repo -b "true"
} else {
  gh variable set FINANCE_AUTO_DEPLOY -R $Repo -b "false"
}

Write-Host ""
Write-Host "Done. Verify:"
Write-Host "  gh secret list -R $Repo"
Write-Host "  gh variable list -R $Repo"
