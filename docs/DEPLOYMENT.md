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

### קובץ `VERSION` ועדכון אוטומטי (`safe-update.sh`)

- ה-API והממשק קוראים את הגרסה מקובץ **`VERSION`** בשורש הפרויקט (בדרך כלל `/opt/finance-app/VERSION`).
- **חובה** לעדכן את `VERSION` ב־`main` בכל שחרור (release) כך שיתאים לתג ב-GitHub (למשל `2.0.29` בלי קידומת `v`).
- אם שוחרר release לפני שקומיט של `VERSION` הגיע ל־`main`, עדיין אפשר ש־`git pull` ימשוך קוד חדש בעוד שקובץ `VERSION` נשאר ישן — ואז הממשק יציג "העדכון הושלם" אבל גרסה ישנה. הסקריפט `scripts/safe-update.sh`, אחרי בדיקת בריאות מוצלחת, **מיישר את `VERSION` ל־`targetVersion` מקובץ הטריגר** (שנוצר מ־`POST /version/trigger-update`), כך שהגרסה המוצגת תתאים לעדכון שהמשתמש ביקש.

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

קבצים מומלצים לתיעוד ציבורי:

- Bash: `lxc_full_stack_update.sh` (עדכון מלא: git pull + backend + frontend), `lxc_backend_only.sh`, `run_split_bills_on_lxc.sh`, `lxc_pull_ollama_model.sh`
- PowerShell: `lxc_full_stack_update.ps1`, `rebuild_backend_remote.ps1`, `run_split_bills_remote.ps1`, `pull_ollama_model_remote.ps1`

דוגמה להרצה ב-PowerShell (עדכון מלא אחרי `git push` ל־`main`):

```powershell
$env:FINANCE_HYPERVISOR_SSH = "user@hypervisor.example"
$env:FINANCE_GUEST_VMID = "XXX"
$env:FINANCE_PROJECT_ON_GUEST = "/opt/finance-app"
.\scripts\lxc_full_stack_update.ps1
```

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
