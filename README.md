# 💰 ניהול פיננסי אישי

> אפליקציית ניהול פיננסי אישי עם חיבור לבנקים ישראליים

## ✨ תכונות

- 🏦 חיבור ל-18 בנקים וחברות אשראי ישראליות
- 📊 לוח בקרה עם סיכום חודשי
- 💳 מעקב עסקאות אוטומטי
- 📅 ניהול תקציב חודשי
- 🏷️ סיווג אוטומטי לפי מילות מפתח
- 📱 ממשק רספונסיבי (מובייל + דסקטופ)
- 🔒 אבטחה מלאה (הצפנה, JWT, 2FA)
- 🤖 אינטגרציה עם OLLAMA לסיווג חכם
- 🔔 התראות דרך n8n

## 🛠️ טכנולוגיות

| שכבה | טכנולוגיה |
|------|----------|
| Frontend | React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | NestJS, TypeScript, Prisma |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Scraping | israeli-bank-scrapers |
| Container | Docker, Docker Compose |

## 🚀 התקנה

### דרישות מקדימות

- Docker & Docker Compose
- Node.js 22+ (לפיתוח)
- Git

### התקנה מהירה
```bash
# Clone
git clone https://github.com/HirezRa/finance-app.git
cd finance-app

# הגדרת משתני סביבה
cp .env.example .env
# ערוך את .env עם הערכים שלך

# הפעלה
docker compose up -d

# גישה
# http://localhost
```

### יצירת מפתחות
```bash
# JWT Secret
openssl rand -hex 32

# Encryption Key
openssl rand -hex 32
```

## 📖 תיעוד

- [מדריך התקנה מלא](docs/INSTALLATION.md)
- [הגדרות](docs/CONFIGURATION.md)
- [ארכיטקטורה](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [פתרון בעיות](docs/TROUBLESHOOTING.md)

## 🏦 מוסדות נתמכים

### בנקים
- בנק הפועלים
- בנק לאומי
- בנק דיסקונט
- בנק מזרחי-טפחות
- בנק יהב
- בנק אוצר החייל
- ועוד...

### כרטיסי אשראי
- ישראכרט
- ויזה כאל
- מקס
- אמריקן אקספרס

## 🔒 אבטחה

- הצפנת AES-256-GCM לפרטי בנק
- JWT + Refresh Tokens
- אימות דו-שלבי (TOTP)
- Rate Limiting
- Security Headers

## 📜 רישיון

MIT License - ראה [LICENSE](LICENSE)

## 👤 מחבר

[HirezRa](https://github.com/HirezRa)
