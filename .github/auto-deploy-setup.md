# GitHub Actions: automatic remote deploy

This workflow (`deploy-remote.yml`) runs `scripts/deploy_to_lxc.sh`. Two modes:

| Mode | `FINANCE_DEPLOY_SSH_HOST` | `pct` |
|------|---------------------------|--------|
| **Default** (`FINANCE_DEPLOY_VIA_PCT` unset or `true`) | Proxmox **hypervisor** IP/hostname | Used with `FINANCE_DEPLOY_GUEST_VMID` |
| **Direct** (`FINANCE_DEPLOY_VIA_PCT=false`) | The machine that runs Docker (often the **CT/LXC IP**) | Not used — `pct` exists only on the Proxmox host |

If you SSH to something like `10.0.0.x` and get `pct: command not found`, that host is **not** the hypervisor; use **direct** mode or point SSH at the real Proxmox node.

## Requirements

1. The runner must reach `FINANCE_DEPLOY_SSH_HOST` (public IP/hostname, VPN, or a **self-hosted** runner on your LAN — change `runs-on` in the workflow).
2. **pct mode:** SSH user can run `pct exec <VMID> -- …` on that host.
3. **Direct mode:** SSH session lands on the Docker host; keys/password allow login.
4. Guest/host already has a git clone at `FINANCE_DEPLOY_PROJECT_PATH` (default `/opt/finance-app`) and Docker Compose configured.

## Repository secrets

| Name | Value |
|------|--------|
| `FINANCE_DEPLOY_SSH_KEY` | Private key (PEM / OpenSSH format) allowed to log in to the hypervisor. **Never commit this.** |

## Repository variables

| Name | Example | Required |
|------|---------|----------|
| `FINANCE_DEPLOY_SSH_HOST` | Hypervisor or Docker host IP | Yes |
| `FINANCE_DEPLOY_SSH_USER` | `root` | No (defaults to `root` in workflow) |
| `FINANCE_DEPLOY_GUEST_VMID` | `100` | Required when **pct** mode |
| `FINANCE_DEPLOY_VIA_PCT` | `false` | No — set to `false` for SSH **direct** to Docker host (skip VMID/pct) |
| `FINANCE_DEPLOY_PROJECT_PATH` | `/opt/finance-app` | No |
| `FINANCE_AUTO_DEPLOY` | `true` | No — if `true`, every push to `main` runs deploy; otherwise only **workflow_dispatch** |

## How to run

- **Manual:** GitHub → Actions → **Deploy remote stack** → **Run workflow**.
- **On push to `main`:** set `FINANCE_AUTO_DEPLOY` to `true` (use only if your SSH endpoint is reachable and you accept deploy-on-merge).

## One-shot via GitHub CLI (local)

If `gh` is logged in with access to the repo:

```powershell
cd /path/to/finance-app
.\scripts\push-github-deploy-settings.ps1 `
  -SshKeyPath "$env:USERPROFILE\.ssh\id_ed25519" `
  -SshHost "YOUR_SSH_HOSTNAME" `
  -GuestVmid "YOUR_CT_VMID"
```

Direct SSH to Docker (same as `pct: command not found` fix): `-SshDirectToDockerHost` (omit `-GuestVmid`).

Optional: `-AutoDeployOnPush` for `FINANCE_AUTO_DEPLOY=true`. Omit for manual-only deploy from Actions.

## What the script does

Same as local `deploy_to_lxc.sh`: `git pull`, `prisma migrate deploy`, rebuild backend + frontend images, `docker compose up -d`, health check.

## Homelab note

If the hypervisor is only on a private LAN, GitHub’s cloud runners cannot SSH to it unless you expose SSH securely or run a **self-hosted** GitHub Actions runner on a machine that can reach the hypervisor, then set `runs-on: self-hosted` (or your label) in `deploy-remote.yml`.
