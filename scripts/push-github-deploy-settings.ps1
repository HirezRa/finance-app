#Requires -Version 5.1
<#
  One-shot: upload GitHub Actions deploy secrets/variables for deploy-remote.yml.
  Requires: gh CLI logged in (gh auth login) with repo + workflow scope.

  Example:
    .\scripts\push-github-deploy-settings.ps1 `
      -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519" `
      -SshHost "proxmox.example.com" `
      -GuestVmid "100"

  Do not commit your private key. Use a deploy key or dedicated SSH key for the hypervisor.
#>
[CmdletBinding()]
param(
  [string] $Repo = "HirezRa/finance-app",
  [Parameter(Mandatory = $true)]
  [string] $SshKeyPath,
  [Parameter(Mandatory = $true)]
  [string] $SshHost,
  [Parameter(Mandatory = $true)]
  [string] $GuestVmid,
  [string] $SshUser = "root",
  [string] $ProjectPath = "/opt/finance-app",
  [switch] $AutoDeployOnPush
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw 'Install GitHub CLI: https://cli.github.com/ - then run: gh auth login'
}

$resolved = Resolve-Path -LiteralPath $SshKeyPath
if (-not (Test-Path -LiteralPath $resolved)) {
  throw "SSH key file not found: $SshKeyPath"
}

Write-Host "Setting secret FINANCE_DEPLOY_SSH_KEY on $Repo ..."
Get-Content -LiteralPath $resolved -Raw | gh secret set FINANCE_DEPLOY_SSH_KEY -R $Repo
if ($LASTEXITCODE -ne 0) { throw "gh secret set failed" }

Write-Host "Setting variables on $Repo ..."
gh variable set FINANCE_DEPLOY_SSH_HOST -R $Repo -b $SshHost
gh variable set FINANCE_DEPLOY_GUEST_VMID -R $Repo -b $GuestVmid
gh variable set FINANCE_DEPLOY_SSH_USER -R $Repo -b $SshUser
gh variable set FINANCE_DEPLOY_PROJECT_PATH -R $Repo -b $ProjectPath
if ($AutoDeployOnPush) {
  gh variable set FINANCE_AUTO_DEPLOY -R $Repo -b "true"
} else {
  gh variable set FINANCE_AUTO_DEPLOY -R $Repo -b "false"
}

Write-Host ""
Write-Host "Done. Verify:"
Write-Host "  gh secret list -R $Repo"
Write-Host "  gh variable list -R $Repo"
