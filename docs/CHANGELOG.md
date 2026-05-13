# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים בקובץ זה.

**מקור אמת מומלץ:** קובץ `CHANGELOG.md` בשורש הריפו (מסונכרן עם תגי GitHub `v*`). קובץ זה ב־`docs/` משוכפל לנוחות; אם יש סתירה — עדיפות לשורש.

## [2.0.51] - 2026-05-13

- עוגן תזרים להכנסה ימים 1–14 בלוח ישראלי: תמיד `date` מול `effectiveDate` legacy (`cashFlowAnchorDateForTxn`).

## [2.0.50] - 2026-05-13

- Dockerfile builder: `PUPPETEER_SKIP_DOWNLOAD` לפני `npm ci` (כשל Puppeteer בזמן `docker compose build`).

## [2.0.49] - 2026-05-13

- הסרת override ל־`@fastify/middie` 9.x (תאימות Fastify 4 + Nest 10).

## [2.0.48] - 2026-05-13

### תיקון (Fastify / Docker)

- הסרת override ל־fastify 5; נעילה ל־4.28.1 (תאימות Nest 10 + helmet). תלות ישירה `fastify` ל־TypeScript.

## [2.0.47] - 2026-05-12

### תיקון (משכורות + תאריכים)

- `effectiveDate` לא מוחל על ימי הפקדה 1–14 בלוח ישראלי; סינון תאריכים לעסקאות לפי ימים אזרחיים בישראל; תיעוד `docs/SALARY_EFFECTIVE_DATE.md`.

### תפעול / לוגים (עדכון אוטומטי)

- `safe-update.sh`: rollback אחרי כישלון build עם נתיבי לוג; שיקוף ללוג האפליקציה עם `diagnosticPaths` + `buildLogTail`; מדריך עדכון מאורח ב־`SELF_UPDATE_MANUAL.md` + פירוט ב־`LOGGING_GUIDE.md`.
- Docker Compose: healthcheck ל־backend, nginx ממתין ל־backend healthy.

## [2.0.46] - 2026-05-12

### תלויות

- israeli-bank-scrapers → hirez-v1.0.19; overlay יהב מעודכן ל־upstream.

## [2.0.45] - 2026-05-12

### Yahav + ייצוא

- Overlay יהב מסונכרן עם upstream v1.0.18 (גלילה + parse); `referenceNumber` ב־convert.
- ייצוא Excel לפי מחזור: כלול אם תאריך בנק או `effectiveDate` בחודש.

## [2.0.44] - 2026-05-12

### תלויות

- **israeli-bank-scrapers** → תג `hirez-v1.0.18` (קומיט `b904bd6`); תלות: `github:HirezRa/israeli-bank-scrapers#hirez-v1.0.18`.

## [2.0.43] - 2026-05-12

### תיקון סנכרון (Yahav)

- `referenceNumber` ב־overlay יהב; hash ב־`ScraperService`: `referenceNumber ?? identifier`; לוג DEBUG לדילוג כפילות לפי `scraperHash`.

## [2.0.42] - 2026-05-11

### לוגים ואבחון

- מילוי `scraperGitSha` / `browserVersion`; `errorFull` ו-redaction; ייצוא `preset=diagnostic`; שיקוף כישלון עדכון גרסה ללוג; `docs/SELF_UPDATE_MANUAL.md`.

## [2.0.41] - 2026-05-10

### תיקון עדכון עצמי (runtime)

- `VersionService`: נרמול `UPDATE_DATA_DIR` כשמזוהה שילוב legacy (`/app/update-data` + `APP_DIR` תחת `/opt/finance-app`).

## [2.0.40] - 2026-05-10

### תיקון עדכון עצמי (שרת)

- Compose: `APP_DIR` / `UPDATE_DATA_DIR` קבועים ל־backend — לא נדרסים מ־`.env` ישן עם `/app/update-data`.
- `install-updater.sh`: יצירת `update-data` + הרשאות; לוג נתיבים ב־backend כש־self-update מופעל.

## [2.0.39] - 2026-05-10

### תיקון עדכון עצמי (Docker)

- **`UPDATE_DATA_DIR`**: יישור ברירת המחדל וה-volume ב־`docker-compose` עם הנתיב ש־`systemd` מצפה לו על ה-host (`/opt/finance-app/update-data`), כדי שקובץ הטריגר `.update-requested` יגיע למארח והעדכון לא יישאר `pending`.

## [2.0.38] - 2026-05-10

### תיקון UI וסקרייפר Yahav

- תאריך בשורת עסקה: תאריך בנק + סימון · בתקציב כשיש `effectiveDate`.
- Yahav: overlay ב־`backend/scraper-overlays/` דרך `ensure-israeli-bank-scrapers`; ללא patch-package על כל החבילה.

## [2.0.36] - 2026-05-09

### תלויות

- **israeli-bank-scrapers** → hirez-v1.0.15 (`ca59b62`).

## [2.0.35] - 2026-05-08

### תלויות

- **israeli-bank-scrapers** → hirez-v1.0.14 (`2daeb3b`).
- עדכון `npm` ב-backend ו-frontend בטווחי ה-`^` הקיימים.

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
