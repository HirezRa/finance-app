# Finance App — ניהול פיננסי אישי

אפליקציית ווב לניהול פיננסי אישי עם סנכרון מחשבונות בישראל (בנקים וכרטיסי אשראי) באמצעות [israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (fork של HirezRa).

## פילוסופיה

> מספר אחד ברור: כמה נשאר להוציא החודש — דרך דשבורד, תקציבים והתראות.

## תכונות עיקריות (מוכחות בקוד ובפריסה)

- סנכרון ממוסדות פיננסיים ישראליים (רשימה ב-[ARCHITECTURE.md](./ARCHITECTURE.md))
- דשבורד: סיכום חודשי, פילוח שבועי, קטגוריות, עסקאות אחרונות, חשבונות
- תקציבים לפי קטגוריות מול הוצאה בפועל (אותו טווח תאריכים כמו הדשבורד)
- סיווג אוטומטי לפי מילות מפתח (`keywords` כ-JSON)
- JWT, refresh, רשימת חסימה ב-Redis
- 2FA (TOTP) וקודי שחזור מוצפנים
- התראות (Cron) ו-webhook ל-n8n אחרי סנכרון כשמופעל אצל המשתמש
- OLLAMA ו-n8n מהגדרות בממשק (נשמר ב-DB)

## ארכיטקטורה (נוכחית ב-repo)

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + Radix/shadcn-style components |
| Backend | NestJS 10 + Fastify + Prisma 5 + PostgreSQL 16 |
| תור | Bull (@nestjs/bull) + Redis 7 |
| סקרייפר | `israeli-bank-scrapers` (build מ-GitHub בתוך Dockerfile) + Chromium באלפין |
| פריסה | Docker Compose (nginx מקדים, frontend static, backend) |

## מסמכים

| מסמך | תיאור |
|------|--------|
| [FEATURES.md](./FEATURES.md) | רשימת תכונות המערכת |
| [CHANGELOG.md](./CHANGELOG.md) | יומן גרסאות |
| [INSTALLATION.md](./INSTALLATION.md) | דרישות, Docker, הרצה ראשונה |
| [CONFIGURATION.md](./CONFIGURATION.md) | `.env`, Compose, Prisma, שירותים |
| [API.md](./API.md) | נקודות קצה עיקריות ו-prefix |
| [DATABASE.md](./DATABASE.md) | ERD, טבלאות, שדות חשובים |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | פריסה על שרת, עדכון גרסה |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | תרשים זרימה, מודולים, מוסדות נתמכים |
| [SECURITY.md](./SECURITY.md) | JWT, 2FA, הצפנה, throttling |
| [PENDING_TRANSACTIONS.md](./PENDING_TRANSACTIONS.md) | Pending מול Completed, התאמות, הגדרות |
| [SALARY_SETTINGS.md](./SALARY_SETTINGS.md) | טווח משכורת, `effectiveDate`, דוגמאות |
| [CREDIT_CARD_CHARGES.md](./CREDIT_CARD_CHARGES.md) | מניעת כפילות חיובי אשראי מהבנק |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | בעיות נפוצות (P3015, Chromium, cache) |
| [SCRAPER_CHROMIUM_DOCKER.md](./SCRAPER_CHROMIUM_DOCKER.md) | Chromium ב-Docker — אבחון מפורט |
