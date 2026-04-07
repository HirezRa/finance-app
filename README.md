# 💰 ניהול פיננסי אישי

> אפליקציה לניהול פיננסי אישי עם חיבור לבנקים ישראליים

## ✨ תכונות

- 🏦 חיבור ל-18 בנקים וחברות אשראי ישראליות
- 📊 לוח בקרה עם סיכום חודשי
- 💳 מעקב עסקאות אוטומטי
- 📅 ניהול תקציב חודשי
- 🏷️ סיווג אוטומטי לפי מילות מפתח
- 📱 ממשק רספונסיבי
- 🔒 אבטחה מלאה (הצפנה, JWT, 2FA)

## 🚀 התקנה מהירה
```bash
git clone https://github.com/HirezRa/finance-app.git
cd finance-app
cp .env.example .env
# ערוך את .env
docker compose up -d
```

## 📖 תיעוד

- [מדריך התקנה](docs/INSTALLATION.md)
- [הגדרות](docs/CONFIGURATION.md)
- [פריסה](docs/DEPLOYMENT.md)
- [API](docs/API.md)

## 🛠️ טכנולוגיות

| שכבה | טכנולוגיה |
|------|----------|
| Frontend | React 19, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |

## 📜 רישיון

MIT License
