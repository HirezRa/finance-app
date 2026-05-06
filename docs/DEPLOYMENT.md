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

## פריסה על שרת Linux (Docker)

בסביבות עם Docker על שרת Linux:

- **Git** — בשלב build של תמונת ה-backend (`npm ci` + `postinstall`) נדרשת גישה ל־GitHub לשיבוט תלות הסקרייפר.
- **דיסק** — בניית הסקרייפר (`build:js` בתוך ה-fork) ותלות Puppeteer תופסות מקום; מומלץ ≥10GB פנויים כמו בדרישות למעלה.

### עדכון

```bash
cd /path/to/your/checkout
git pull
docker compose build --no-cache backend frontend
docker compose down --remove-orphans
docker compose up -d
```

בדיקת בריאות: `curl -s http://localhost/api/v1/health` (או דרך ה-reverse proxy לפי ההגדרה שלכם).

### הערות סקרייפר

- תיקוני DOM בחבילת הסקרייפר יושבים ב־`backend/patches/` ומוחלים אוטומטית ב־`postinstall` אחרי בניית `lib` של ה-fork.
- אם build נכשל על clone או timeout ל-GitHub — בדקו DNS, חומת אש ו-proxy.

### סקריפטים אופציונליים (הפעלה מרחוק)

בתיקייה `scripts/` קיימים כלי עזר לפריסה/תחזוקה דרך SSH להיפרוויזור ואז `pct exec` לאורח Linux (התאימו מזהי VM ונתיבים אצלכם — **אל** לשמור ערכים אמיתיים ב-git):

- `FINANCE_HYPERVISOR_SSH` — יעד SSH להיפרוויזור (למשל `user@host`).
- `FINANCE_GUEST_VMID` — מזהה האורח שבו רץ Docker והפרויקט.
- `FINANCE_PROJECT_ON_GUEST` — נתיב הפרויקט על האורח (ברירת מחדל: `/opt/finance-app`).
- `FINANCE_OLLAMA_GUEST_VMID` — אופציונלי; לאורח נפרד ל-Ollama (`lxc_pull_ollama_model.sh`).

קבצים: `deploy_to_lxc.sh`, `lxc_backend_only.sh`, `run_split_bills_on_lxc.sh`, `lxc_pull_ollama_model.sh`.

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
