# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים בקובץ זה.

## [2.0.30] - 2026-05-07

### טכני

- עדכון `israeli-bank-scrapers` ל־commit `7a4efd4` ([HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers), ענף `master`)
- הסרת `patch-package` ל־Yahav — התיקון נמצא בקוד ה־fork
- תיקון `ScraperUpdateService`: בדיקת commit אחרון מול `master` (לא `main`)
- הסרת תלות כפולה `@hirez10/israeli-bank-scrapers` מ־`package.json`

## [1.0.0] - 2026-04-08

### תכונות עיקריות

- חיבור ל-18 בנקים וחברות אשראי ישראליות
- לוח בקרה עם סיכום חודשי וניווט בין חודשים
- מעקב עסקאות אוטומטי עם סיווג חכם
- ניהול תקציב חודשי עם התראות
- קטגוריות מותאמות אישית עם מילות מפתח
- הגדרות משכורת (`effectiveDate`)
- מניעת כפילויות חיובי אשראי
- הערות לעסקאות
- כינוי ותיאור לחשבונות
- מעקב תשלומים (X מתוך Y)
- מחיקת נתונים עם אישור
- אבטחה מלאה (JWT, הצפנה AES-256, 2FA)

### טכני

- React + TypeScript + Tailwind CSS
- NestJS + Prisma + PostgreSQL
- Docker Compose לפריסה
- israeli-bank-scrapers לסנכרון
- Endpoint גרסה: `GET /api/v1/version`

### Documentation

- תיעוד שכבת `docs/`: תכונות, מסד נתונים, משכורת, חיובי אשראי, pending, פריסה, פתרון בעיות
