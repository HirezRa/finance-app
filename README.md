# 💰 ניהול פיננסי אישי

אפליקציה לניהול פיננסי אישי בעברית — מותאמת לישראל.

> **מספר אחד — כמה נשאר להוציא**

## ✨ תכונות

- 🏦 **סנכרון בנקים** — חיבור לכל הבנקים וחברות האשראי בישראל
- 📊 **לוח בקרה** — תמונת מצב פיננסית ברורה
- 🏷️ **סיווג חכם** — סיווג אוטומטי עם AI (Ollama/OpenRouter)
- 💱 **עסקאות מט"ח** — תמיכה בעסקאות חו"ל עם שער המרה
- 📱 **רספונסיבי** — עובד בדסקטופ ובמובייל
- 🔄 **עדכון עצמי** — עדכון האפליקציה מתוך הממשק
- 🔐 **אבטחה** — הצפנת סיסמאות AES-256-GCM + 2FA

## 🛠️ טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | NestJS + Fastify + Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Queue | BullMQ |
| Bank Scraping | [HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (מ־GitHub; בסיס upstream [eshaham](https://github.com/eshaham/israeli-bank-scrapers); commit מנוהל ב־lockfile + `ensure-israeli-bank-scrapers` + `patch-package` אם יש טלאים) |
| AI | Ollama / OpenRouter |
| Container | Docker Compose |

אופציונלי — **Proxmox MCP Plus** (ניטור PVE מתוך Cursor): [docs/PROXMOX_MCP.md](docs/PROXMOX_MCP.md).

## 🏦 מוסדות נתמכים

רשימת מזהים ושמות תצוגה מעודכנים בקוד (`getSupportedInstitutions`) — ראו [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

מבוסס על [HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (fork; מסונכרן מ־eshaham). תיקוני DOM ל־Yahav נמצאים בקוד ה־fork. פירוט: [docs/SCRAPER_DATE_PICKER_DOM.md](docs/SCRAPER_DATE_PICKER_DOM.md).

## 📦 התקנה

### דרישות

- Docker & Docker Compose
- Git

### שלבים

```bash
# שכפל את הפרויקט
git clone https://github.com/HirezRa/finance-app.git
cd finance-app

# העתק קובץ הגדרות
cp .env.example .env

# ערוך את קובץ ההגדרות
nano .env

# הפעל
docker compose up -d
```

האפליקציה תהיה זמינה ב: http://localhost

## ⚙️ הגדרות סביבה

| משתנה | תיאור | ברירת מחדל |
|-------|--------|-------------|
| `DATABASE_URL` | חיבור PostgreSQL | — |
| `REDIS_URL` | חיבור Redis | — |
| `JWT_SECRET` | מפתח JWT | — |
| `ENCRYPTION_MASTER_KEY` | מפתח הצפנה (64 hex) | — |
| `LLM_PROVIDER` | ספק AI: none/ollama/openrouter | none |
| `OLLAMA_URL` | כתובת Ollama | http://localhost:11434 |
| `OLLAMA_MODEL` | מודל Ollama | qwen2.5:3b |

## 🔐 אבטחה

- כל הסיסמאות מוצפנות ב-AES-256-GCM
- JWT + Refresh Tokens
- תמיכה ב-2FA (TOTP)
- סיסמאות בנק לא נשמרות בטקסט גלוי

## 📝 גרסאות

ראה [CHANGELOG.md](CHANGELOG.md) לרשימת שינויים מלאה.

**גרסה נוכחית:** ראה קובץ `VERSION` במאגר.

## 📄 רישיון

MIT
