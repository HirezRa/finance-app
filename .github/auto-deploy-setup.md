# GitHub Actions: automatic remote deploy

This workflow (`deploy-remote.yml`) runs `scripts/deploy_remote_guest.sh`. Two modes:

| Mode | `FINANCE_DEPLOY_SSH_HOST` | Guest-exec wrap |
|------|---------------------------|-----------------|
| **Default** (`FINANCE_DEPLOY_VIA_PCT` unset or `true`) | Management / virtualization host | Used with `FINANCE_DEPLOY_GUEST_VMID` |
| **Direct** (`FINANCE_DEPLOY_VIA_PCT=false`) | The machine that runs Docker | Not used on that SSH hop |

If you connect to a host intended for application workloads and the **guest-exec** helper is missing from `$PATH`, that host is probably **not** the management endpoint; use **direct** mode or point SSH at the correct management host.

## Requirements

1. The runner must reach `FINANCE_DEPLOY_SSH_HOST` (public hostname, VPN, or a **self-hosted** runner on your LAN — change `runs-on` in the workflow).
2. **Guest-exec mode:** SSH user can run the platform’s **guest shell** command with `FINANCE_DEPLOY_GUEST_VMID` on that host.
3. **Direct mode:** SSH session lands on the Docker host; keys/password allow login.
4. Guest/host already has a git clone at `FINANCE_DEPLOY_PROJECT_PATH` (default `/opt/finance-app`) and Docker Compose configured.

## Repository secrets

| Name | Value |
|------|-------|
| `FINANCE_DEPLOY_SSH_KEY` | Private key (PEM / OpenSSH format) allowed to log in to the SSH target. **Never commit this.** |

## Repository variables

| Name | Example | Required |
|------|---------|----------|
| `FINANCE_DEPLOY_SSH_HOST` | Your server hostname or IP | Yes |
| `FINANCE_DEPLOY_SSH_USER` | `root` | No (defaults to `root` in workflow) |
| `FINANCE_DEPLOY_GUEST_VMID` | `100` | Required in guest-exec mode |
| `FINANCE_DEPLOY_VIA_PCT` | `false` | No — set to `false` for **direct** SSH to Docker host (skip VMID / guest-exec on that hop) |
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
  -GuestVmid "YOUR_GUEST_VMID"
```

Direct SSH to Docker (same as “guest-exec helper missing” fix): `-SshDirectToDockerHost` (omit `-GuestVmid`).

Optional: `-AutoDeployOnPush` for `FINANCE_AUTO_DEPLOY=true`. Omit for manual-only deploy from Actions.

## What the script does

Same as local `deploy_remote_guest.sh`: `git pull`, `prisma migrate deploy`, rebuild backend + frontend images, `docker compose up -d`, health check.

## Private networks

If the management host is only on a private LAN, GitHub’s cloud runners cannot SSH to it unless you expose SSH securely or run a **self-hosted** GitHub Actions runner on a machine that can reach it, then set `runs-on: self-hosted` (or your label) in `deploy-remote.yml`.
