# פריסה (Deployment)

## דרישות שרת

- Docker & Docker Compose
- מינימום 2GB RAM
- 10GB דיסק פנוי

## התקנה על שרת

### 1. Clone הפרויקט
```bash
git clone https://github.com/HirezRa/finance-app.git
cd finance-app
```

### 2. הגדרת משתני סביבה
```bash
cp .env.example .env
nano .env  # ערוך את הערכים
```

### 3. יצירת מפתחות
```bash
# JWT Secret
openssl rand -hex 32

# Encryption Key
openssl rand -hex 32
```

### 4. הפעלה
```bash
docker compose up -d
```

### 5. מיגרציות
```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### 6. גישה

פתח בדפדפן: `http://YOUR_SERVER_IP`

## עדכון גרסה
```bash
git pull
docker compose build --no-cache backend frontend
docker compose up -d
```

## פריסה על LXC (Proxmox)

סביבת הייצור אצלך: קונטיינר **LXC** (למשל `pct` 115) עם Docker, והקוד תחת **`/opt/finance-app`**.

### דרישות בתוך ה-LXC

- **Git** — בשלב build של תמונת ה-backend (`npm ci` + `postinstall`) נדרש clone של [HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) ורשת יציבה אל GitHub.
- **דיסק** — בניית הסקרייפר (`build:js` בתוך ה-fork) ו-Puppeteer dependencies תופסים מקום; מומלץ ≥10GB פנויים כמו בדרישות למעלה.

### עדכון מההוסט (ידני ב-LXC)

```bash
cd /opt/finance-app
git pull
docker compose build --no-cache backend frontend
docker compose down --remove-orphans
docker compose up -d
```

לאחר מכן בדיקת בריאות: `curl -s http://localhost/api/v1/health` (או דרך nginx לפי ההגדרה אצלך).

### סקריפט מרחוק דרך Proxmox

ב-repo קיים `scripts/lxc_backend_only.sh` — מתחבר להוסט Proxmox, מריץ `pct exec 115` עם `git pull` + בניית backend + `docker compose up`. התאם `PROXMOX`, מספר ה-VMID ונתיב הפרויקט אם אצלך אחרים.

### הערות סקרייפר

- תיקוני Yahav ועוד יושבים ב־`backend/patches/` ומוחלים אוטומטית ב־`postinstall` אחרי בניית `lib` של ה-fork.
- אם build נכשל על clone או timeout ל-GitHub — בדוק DNS, חומת אש, ו-proxy בתוך ה-LXC.

## פקודות שימושיות
```bash
# צפייה בלוגים
docker compose logs -f backend

# כניסה לקונטיינר
docker compose exec backend sh

# גיבוי Database
docker compose exec db pg_dump -U finance finance_app > backup.sql

# שחזור Database
docker compose exec -T db psql -U finance finance_app < backup.sql
```
