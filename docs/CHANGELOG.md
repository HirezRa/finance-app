# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים בקובץ זה.

**מקור אמת מומלץ:** קובץ `CHANGELOG.md` בשורש הריפו (מסונכרן עם תגי GitHub `v*`). קובץ זה ב־`docs/` משוכפל לנוחות; אם יש סתירה — עדיפות לשורש.

## [2.0.34] - 2026-05-08

### אבטחה ותיעוד

- ניקוי תיעוד ציבורי מתבניות תשתית; סקריפט `verify-public-docs-safety.cjs` ו-CI; איחוד שמות סקריפטי פריסה מרחוק.

## [2.0.33] - 2026-05-07

### טכני (ניהול גרסאות)

- יישור שדות `version` ב־`package.json` של frontend/backend וה־lockfiles עם גרסת המוצר.

## [2.0.32] - 2026-05-07

### שיפורים (סקרייפר)

- **israeli-bank-scrapers** עודכן ל־[hirez-v1.0.12](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.12) (תיקון Yahav date-picker ועוד).
- **`ensure-israeli-bank-scrapers`**: שכפול ref מ־`package.json`, חותמת דילוג כשה־ref לא השתנה, ו־`git fetch`/`checkout` בעת שדרוג תג.

## [2.0.31] - 2026-05-07

### שיפורים (לוגים וסנכרון)

- **Structured logging** לסנכרון: `syncRunId`, lifecycle, טקסונומיית שגיאות, מדדים, תור Bull ו-runtime.
- **Partial sync**: כשל בחשבון בודד לא עוצר את שאר החשבונות.
- **פרטיות**: הרחבת sanitization ב־`LogsService`.
- **תיעוד**: `LOGGING_GUIDE.md`.
- **Docker / פריסה**: `SCRAPER_GIT_SHA`, `CHROMIUM_VERSION`.

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
