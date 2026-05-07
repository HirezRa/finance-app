$ErrorActionPreference = "Stop"
# Wrapper — canonical steps in deploy_remote_guest.ps1 (includes prisma migrate).
& "$PSScriptRoot\deploy_remote_guest.ps1"
