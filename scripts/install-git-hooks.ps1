# Sets repo-local Git hooks (pre-commit sensitive scan). Run from repo root:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-git-hooks.ps1

$ErrorActionPreference = "Stop"
if (-not $PSScriptRoot) {
  $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
git config core.hooksPath .githooks
Write-Host "Configured core.hooksPath=.githooks for $(git rev-parse --show-toplevel)"
