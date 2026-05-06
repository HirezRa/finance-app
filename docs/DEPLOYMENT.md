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

בתיקייה `scripts/` קיימים כלי עזר לפריסה/תחזוקה דרך SSH לשרת הניהול ואז הרצת פקודות על שרת האפליקציה (התאימו מזהים ונתיבים אצלכם — **אל** לשמור ערכים אמיתיים ב-git):

- `FINANCE_HYPERVISOR_SSH` — יעד SSH לשרת הניהול (למשל `user@host`).
- `FINANCE_GUEST_VMID` — מזהה שרת האפליקציה שבו רץ Docker והפרויקט.
- `FINANCE_PROJECT_ON_GUEST` — נתיב הפרויקט על שרת האפליקציה (ברירת מחדל: `/opt/finance-app`).
- `FINANCE_OLLAMA_GUEST_VMID` — אופציונלי; שרת נפרד ל-Ollama.

קבצים מומלצים לתיעוד ציבורי: `deploy_remote_guest.sh`, `rebuild_backend_remote.sh`, `run_split_bills_remote.sh`, `pull_ollama_model_remote.sh`.

### CI/CD מאובטח (GitHub + עדכון שרתים)

- Merge ל-`main` רק לאחר מעבר workflow: build backend/frontend + סריקת סודות.
- שמרו פרטי SSH/גישה כ-GitHub Encrypted Secrets בלבד; אין hardcoded IP/מזהים בקוד.
- בצעו פריסה דרך סקריפט מרוחק שמקבל מזהים ממשתני סביבה, עם timeout ו-health-check.
- שמרו לוגי פריסה בסביבת השרת בלבד; לתיעוד ציבורי העלו סיכומים אנונימיים ללא מזהים/ספקים חיצוניים.

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
