# פריסה

## סביבת יעד

- **Proxmox** — `ssh` כ-`root` (החלף בכתובת ה-IP או השם של שרת Proxmox שלך).
- **LXC** — למשל CT **115**, אפליקציה ב-`/opt/finance-app`.
- **Docker Compose** — `backend`, `frontend`, `db`, `redis`, `nginx`, וכו'.

תיעוד נלווה: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (P3015, Chromium, cache).

## תהליך פריסה מלא (מומלץ)

### 1. אריזה (מחשב פיתוח)

מתוך תיקייה עם `docker-compose.yml` ועם `backend/` + `frontend/`:

```powershell
Set-Location path\to\finance-app
tar -czf C:\Temp\finance-deploy.tar.gz --exclude=backend/node_modules --exclude=frontend/node_modules --exclude=backend/dist --exclude=frontend/dist docker-compose.yml backend frontend
```

### 2. SCP ל-Proxmox

```text
scp -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=2 -o StrictHostKeyChecking=no C:\Temp\finance-deploy.tar.gz root@PROXMOX_IP:/tmp/
```

### 3. pct push ל-LXC

```bash
pct push 115 /tmp/finance-deploy.tar.gz /tmp/finance-deploy.tar.gz
```

### 4. חילוץ ב-LXC

```bash
ssh root@PROXMOX_IP "timeout 120 pct exec 115 -- bash -lc 'cd /opt/finance-app; tar -xzf /tmp/finance-deploy.tar.gz'"
```

**הערת PowerShell:** לא לשלב `&&` בשורה הפנימית אם ה-shell המקומי שובר את המחרוזת; השתמשו ב-`;` בתוך `bash -lc`.

### 5. ניקוי מיגרציות ריקות (לפני migrate)

```bash
ssh root@PROXMOX_IP "timeout 60 pct exec 115 -- bash -lc 'cd /opt/finance-app; find backend/prisma/migrations -type d -empty -delete 2>/dev/null || true'"
```

### 6. Build

```bash
ssh root@PROXMOX_IP "timeout 900 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose build --no-cache backend frontend'"
```

### 7. מיגרציה

```bash
ssh root@PROXMOX_IP "timeout 180 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose up -d db && sleep 5 && docker compose exec -T backend npx prisma migrate deploy'"
```

אם **Prisma P3015** (תיקייה ריקה):

```bash
ssh root@PROXMOX_IP "timeout 60 pct exec 115 -- bash -lc 'docker exec finance-backend find /app/prisma/migrations -type d -empty -delete'"
```

ואז שוב `prisma migrate deploy`.

### 8. תיקון חיובי אשראי (אופציונלי)

```bash
ssh root@PROXMOX_IP "timeout 120 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose exec -T backend npx ts-node prisma/fix-credit-charges.ts'"
```

### 8b. סדר ראשוני לקטגוריות בתקציב (חד-פעמי אחרי מיגרציית `sortOrder`)

```bash
ssh root@PROXMOX_IP "timeout 120 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose exec -T backend npx ts-node prisma/fix-budget-sort-order.ts'"
```

### 9. הפעלה ואימות אימג׳ חדש

```bash
ssh root@PROXMOX_IP "timeout 180 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose down && docker compose up -d'"
```

לאחר `build` חובה `down`/`up` או `--force-recreate backend` — אחרת קונטיינר עשוי לרוץ עם שכבת קבצים ישנה.

```bash
ssh root@PROXMOX_IP "timeout 60 pct exec 115 -- bash -lc 'cd /opt/finance-app && docker compose logs --tail=40 backend'"
```

מצפים ל-`Nest application successfully started`.

### 10. תיעוד בשרת

לאחר חילוץ, קבצי `docs/` זמינים תחת `/opt/finance-app/docs/`.

## מה שעובד בפועל (סיכום)

- העלאה ל-**Proxmox** (SSH כ-root).
- **LXC** עם Docker, אפליקציה ב-`/opt/finance-app`.
- `scp` → `pct push` → חילוץ → `docker compose build` → `migrate deploy` → `up -d`.

## גישה חלופית: אריזת backend ו-frontend בנפרד

מתוך שורש הפרויקט (או `02_SERVICES/finance_app`):

**Backend:**

```powershell
Set-Location backend
tar -czf ..\deploy_out\finance_backend.tar.gz --exclude=node_modules --exclude=dist --exclude=*.log .
Set-Location ..
```

**Frontend** (קבצים כמו ב-Dockerfile):

```powershell
Set-Location frontend
tar -czf ..\deploy_out\finance_frontend.tar.gz src package.json vite.config.ts tsconfig.json index.html tailwind.config.js postcss.config.js nginx.conf
Set-Location ..
```

## העלאה ל-Proxmox

```powershell
scp -o ConnectTimeout=10 deploy_out\finance_backend.tar.gz root@PROXMOX_IP:/tmp/
scp -o ConnectTimeout=10 deploy_out\finance_frontend.tar.gz root@PROXMOX_IP:/tmp/
```

## ב-host של Proxmox

```bash
pct push 115 /tmp/finance_backend.tar.gz /tmp/finance_backend.tar.gz
pct push 115 /tmp/finance_frontend.tar.gz /tmp/finance_frontend.tar.gz
```

לאחר מכן `pct exec 115` עם סקריפט bash: מחיקת קבצים ישנים ב-`backend/` ו-`frontend/`, `tar -xzf`, `cd /opt/finance-app`, `docker compose down`, `build --no-cache backend frontend`, `up -d`, `docker compose exec -T backend npx prisma migrate deploy`.

דוגמה מלאה ב-repo: `deploy_out/lxc115_apply_dashboard_n8n.sh`, `scripts/deploy_lxc115_phase5c.sh`.

## CRLF

```bash
sed -i 's/\r$//' /tmp/script.sh
```

## אימות

```bash
curl -sS --max-time 10 "http://LXC_IP/api/v1/health"
```

## Rollback

גיבוי `.env` ו-`data/postgres` או snapshot ל-LXC לפני שינוי גדול.

[INSTALLATION.md](./INSTALLATION.md) · [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) · [SCRAPER_CHROMIUM_DOCKER_LXC.md](./SCRAPER_CHROMIUM_DOCKER_LXC.md)
