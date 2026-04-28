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
| Bank Scraping | [israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (fork; upstream [eshaham/israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers)) |
| AI | Ollama / OpenRouter |
| Container | Docker Compose |

## 🏦 בנקים נתמכים

- בנק הפועלים
- בנק לאומי
- בנק דיסקונט
- בנק מזרחי טפחות
- בנק יהב
- ויזה כאל
- ישראכרט
- מקס (לאומי קארד)
- אמריקן אקספרס
- ועוד…

מבוסס על [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) — [fork מקומי](https://github.com/HirezRa/israeli-bank-scrapers) עם שיפורי אבטחה.

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
