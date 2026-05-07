# GitHub Actions: automatic remote deploy

This workflow (`deploy-remote.yml`) runs `scripts/deploy_to_lxc.sh` from a GitHub-hosted runner: it SSHs to your **hypervisor**, then `pct exec` into the **CT** where Docker Compose runs the app.

## Requirements

1. The runner must reach your SSH host (public IP/hostname, VPN, or use a **self-hosted** runner on your network — change `runs-on` in the workflow).
2. The SSH user on the hypervisor can run `pct exec <VMID> -- …`.
3. The guest already has a git clone at `FINANCE_DEPLOY_PROJECT_PATH` (default `/opt/finance-app`) and Docker Compose configured.

## Repository secrets

| Name | Value |
|------|--------|
| `FINANCE_DEPLOY_SSH_KEY` | Private key (PEM / OpenSSH format) allowed to log in to the hypervisor. **Never commit this.** |

## Repository variables

| Name | Example | Required |
|------|---------|----------|
| `FINANCE_DEPLOY_SSH_HOST` | `proxmox.example.com` | Yes |
| `FINANCE_DEPLOY_SSH_USER` | `root` | No (defaults to `root`) |
| `FINANCE_DEPLOY_GUEST_VMID` | `100` | Yes |
| `FINANCE_DEPLOY_PROJECT_PATH` | `/opt/finance-app` | No |
| `FINANCE_AUTO_DEPLOY` | `true` | No — if set to `true`, every push to `main` runs deploy; if unset/false, only **workflow_dispatch** runs deploy |

## How to run

- **Manual:** GitHub → Actions → **Deploy remote stack** → **Run workflow**.
- **On push to `main`:** set `FINANCE_AUTO_DEPLOY` to `true` (use only if your SSH endpoint is reachable and you accept deploy-on-merge).

## What the script does

Same as local `deploy_to_lxc.sh`: `git pull`, `prisma migrate deploy`, rebuild backend + frontend images, `docker compose up -d`, health check.

## Homelab note

If the hypervisor is only on a private LAN, GitHub’s cloud runners cannot SSH to it unless you expose SSH securely or run a **self-hosted** GitHub Actions runner on a machine that can reach the hypervisor, then set `runs-on: self-hosted` (or your label) in `deploy-remote.yml`.
