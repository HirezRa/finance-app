# מדריך התקנה

המסמך מתאר התקנה על **Debian 12** בתוך **LXC ב-Proxmox**, עם **Docker Compose** — זהו הנתיב שעובד בפועל בסביבת HomeLab (CT 115, אפליקציה ב-`/opt/finance-app`).

## דרישות מקדימות

### Proxmox

- גישת `root` ל-host
- אחסון ו-template ל-Debian 12 standard
- גשר רשת (למשל `vmbr0`) וטווח IP פנימי

### מכסות מומלצות ל-LXC של האפליקציה

| משאב | מינימום | מומלץ |
|------|---------|--------|
| RAM | 4 GB | 4–8 GB |
| Disk | 32 GB | 32 GB+ |
| CPU | 2 cores | 4 cores |
| nesting | כן (`features: nesting=1`) | נדרש ל-Docker בתוך LXC |

## שלב 1: יצירת LXC (דוגמה)

הפקודה להלן **תבנית** — יש להתאים:

- שם template בפועל ב-`local:vztmpl/...`
- אחסון `rootfs` (`local-lvm` וכו')
- כתובת IP ושער

```bash
pct create 115 local:vztmpl/debian-12-standard_12.x-amd64.tar.zst \
  --hostname finance-app \
  --memory 4096 \
  --swap 2048 \
  --cores 4 \
  --rootfs local-lvm:32 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.xxx/24,gw=192.168.1.1 \
  --features nesting=1,keyctl=1 \
  --unprivileged 1
```

### Chromium / Puppeteer בתוך LXC

ללא הרפיה מספקת ב-AppArmor/Chromium עלול להיכשל עם שגיאות namespace (ראו [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) ו-[SCRAPER_CHROMIUM_DOCKER_LXC.md](./SCRAPER_CHROMIUM_DOCKER_LXC.md)).

בסביבה שעובדת נוספה ל-`/etc/pve/lxc/115.conf` (או מזהה ה-CT שלכם) שורה כמו:

```text
lxc.apparmor.profile: unconfined
```

> אבטחה: מרכך את בידוד ה-container — מתאים ל-homelab כאשר חייבים דפדפן אוטומטי בקונטיינר.

## שלב 2: התקנת Docker ב-LXC

```bash
pct start 115
pct exec 115 -- bash -lc 'apt-get update && apt-get upgrade -y'
pct exec 115 -- bash -lc 'apt-get install -y curl git ca-certificates gnupg'
pct exec 115 -- bash -lc 'curl -fsSL https://get.docker.com | sh'
pct exec 115 -- bash -lc 'apt-get install -y docker-compose-plugin'
pct exec 115 -- bash -lc 'docker --version && docker compose version'
```

## שלב 3: Redis וזיכרון (מומלץ)

אם מופיעות שגיאות fork בזמן save של Redis:

```bash
# בתוך ה-LXC
echo "vm.overcommit_memory=1" >> /etc/sysctl.conf
sysctl -p
```

## שלב 4: העתקת הפרויקט

```bash
pct exec 115 -- bash -lc 'mkdir -p /opt/finance-app'
```

העתק את תוכן `finance_app` (כולל `docker-compose.yml`, `backend/`, `frontend/`, `nginx/`, `.env`) ל-`/opt/finance-app`.  
פריסה מעודכנת מ-Windows דרך Proxmox מתוארת ב-[DEPLOYMENT.md](./DEPLOYMENT.md).

## שלב 5: משתני סביבה

```bash
cd /opt/finance-app
cp .env.example .env
nano .env
```

פרטים מלאים: [CONFIGURATION.md](./CONFIGURATION.md).

## שלב 6: הרצה

```bash
cd /opt/finance-app
docker compose up -d
docker compose ps
```

בדיקת בריאות API (דרך nginx על פורט 80 של ה-LXC):

```bash
curl -sS --max-time 10 "http://127.0.0.1/api/v1/health"
```

תשובה צפויה: JSON עם `status: "ok"`.

## שלב 7: מיגרציות ו-seed

```bash
cd /opt/finance-app
docker compose exec -T backend npx prisma migrate deploy
docker compose exec -T backend npx ts-node prisma/seed-keywords.ts
```

ה-`Dockerfile` של ה-backend כבר מריץ `prisma migrate deploy` בעת עליית הקונטיינר; ניתן להריץ שוב ידנית אחרי עדכון קוד.

## שלב 8: גישה מהדפדפן

- UI: `http://<IP-של-LXC>/`
- API: `http://<IP-של-LXC>/api/v1/...`
- Bull Board (אם פתוח מה-host): `http://<IP-של-LXC>:3001/` (מיפוי `3001:3000` ב-compose)

## מה הלאה

- רישום משתמש ראשון דרך ה-UI או `POST /api/v1/auth/register`
- הגדרת סנכרון: [API.md](./API.md) — Scraper
- תקלות: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
