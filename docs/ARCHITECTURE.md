# ארכיטקטורה

## זרימת בקשות

דפדפן → **nginx** (פורטים 80/443) → נתיב `/api/` ל-**backend:3000** (NestJS + Fastify), שאר הנתיבים ל-**frontend:80** (React בנייה סטטית).

ה-backend משתמש ב-**PostgreSQL** ו-**Redis** (תור Bull, רשימת חסימת טוקנים, נעילת חשבון).

**Bull Board** חשוף על פורט **3001** של ה-host (מיפוי ל-3000 בקונטיינר).

## מודולי Backend

| אזור | תפקיד |
|------|--------|
| `health` | בדיקת חיים |
| `auth` | JWT, הרשמה/התחברות, 2FA |
| `encryption` | הצפנת credentials |
| `accounts`, `transactions`, `categories` | ישויות ליבה |
| `budgets` | תקציב מול הוצאה בפועל |
| `dashboard` | סיכומים חודשיים (טווח UTC) |
| `scraper` | Bull, israeli-bank-scrapers, Chromium |
| `settings` | UserSettings, OLLAMA, n8n |
| `alerts` | Cron + webhooks לסנכרון |

## זרימת סנכרון

`POST /scraper/sync/:configId` → תור Bull → `ScraperProcessor` → `ScraperService.runScraper` → סקרייפר הבנק → `processTransactions` (hash, סיווג) → לפי הגדרות משתמש: `N8nWebhookService`.

## מוסדות נתמכים

**18** מוסדות ב-`getSupportedInstitutions()`: בנקים (למשל hapoalim, leumi, discount, mizrahi, yahav, …) וכרטיסי אשראי (isracard, visaCal, max, amex, behatsdaa, …).

## Frontend

React **18**, Vite, TanStack Query, Zustand, React Router.

## קישורים

[SECURITY.md](./SECURITY.md) · [API.md](./API.md) · [SCRAPER_CHROMIUM_DOCKER_LXC.md](./SCRAPER_CHROMIUM_DOCKER_LXC.md)
