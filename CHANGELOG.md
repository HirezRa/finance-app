# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים כאן.

## [2.0.25] - 2026-04-29

### תכונות חדשות

- טאב **"עדכוני תוכנה"** בהגדרות — `VersionChecker` ו-`UpdateSection` (בדיקת/הפעלת עדכונים) הועברו מטאב תצוגה
- **POST `/version/clear-build-log`** — ניקוי `update-data/build.log` מהממשק (לצד לוג בנייה)

### שיפורים (הגדרות / UI)

- חלון **לוג בנייה:** כיוון LTR, גלילה אוטומטית (אופציונלי), צבעי שורה לפי ERROR/WARN/SUCCESS, כפתור ניקוי
- הוסרה הודעת "המאגר ציבורי — … טוקן" מ-`VersionChecker`

### שיפורים (לוגים בשרת)

- `LogsService`: `logUpdate`, `logExternalService`, `logScraperIssue`, `logScraperSuccess` + קטגוריות `update` / `external-service`
- **Scraper:** סיווג שגיאות (auth/timeout/בלוק/parse/רשת) ולוגי הצלחה/כשל מפורטים
- **Ollama / OpenRouter:** לוגי `external-service` בבדיקת חיבור ובקריאות API

### שיפורים (סקריפט עדכון)

- `safe-update.sh`: פורמט לוג `[timestamp] [LEVEL]`, `log_debug` / `log_warn`, שלבי Git/מיגרציה/הפעלה/תקינות מפורטים, שכפול שורות ל-`build.log` כשהקובץ קיים

### שיפורים (תלויות / Docker)

- **npm 11.3.0** בתוך שלב ה-build ב-`backend/Dockerfile` ו-`frontend/Dockerfile` (מבטל הודעת "New major version of npm" בבניית תמונות)
- **Backend `package.json` — `overrides`:** `archiver@7` + `rimraf@5` — מבטלים שרשראות `glob@7` / `inflight` (האזהרות `npm warn deprecated` על `inflight` / `rimraf@2` / `glob@7` מ־exceljs ו־bcrypt)
- שדה **`engines`** (Node ≥20, npm ≥10) ב-backend

### הערות

- **otplib** v12 — עדיין מציג אזהרות `@otplib/*` deprecated; מעבר ל-**v13** דורש שינוי import/API (TypeScript ESM) — לעשות במשימה נפרדת
- **israeli-bank-scrapers** (בתוך Docker) עשוי עדיין להציג `babel` / `glob@7` בזמן `npm install` — מקור בגיליון התלויות של ה-fork
- **npm audit** — לרוב הדיווחים נפתרים רק בעדכון **Nest 11** / **@nestjs/platform-fastify@11** (שינוי שביר) — לא בוצע בגרסה זו

## [2.0.24] - 2026-04-29

### תיקונים

- תיקון Health Check URL במערכת העדכון (`scripts/safe-update.sh`) — ברירת מחדל דרך nginx בפורט 80 במקום פורט 3000; לוגים לדיבוג ניסיונות ה-health check

## [2.0.23] - 2026-04-29

### תיקונים

- תיקון encoding עברית בממשק (`VersionChecker`, `SettingsPage`, `api.ts`)

### תיעוד

- `ENCODING_FIXES.md`, `.editorconfig`

## [2.0.22] - 2026-04-29

### תיקונים

- תיקון בעיית הרשאות במערכת העדכון העצמי — קבצי עדכון בתיקייה ייעודית `update-data/` (לא במעקב git), volume נפרד ב-Docker
- תיקון encoding UTF-8 בקובץ `frontend/index.html` (גרסה קודמת)

### שיפורים

- הצגת לוג בנייה בממשק העדכון (`UpdateSection`) בזמן עדכון ובמקרה כשל
- הצגת פרטי שגיאה כשעדכון נכשל או מתבצע rollback
- סקריפט `safe-update.sh` כותב לוג בנייה מפורט ל-`update-data/build.log`

### שינויים

- הסרת שדה GitHub Token ממסך בדיקת עדכונים — המאגר ציבורי; בדיקת releases ללא אימות
- נתיב systemd לטריגר עדכון: `update-data/.update-requested`

### תיעוד

- עדכון README.md
- הוספת CHANGELOG.md

## [2.0.21] - 2026-04-28

### תיקונים

- `scripts/safe-update.sh` נשמר כ-executable ב-git (תיקון 203/EXEC)

### שיפורים

- תכונות קודמות (UTF-8 לכותרת דף)

## [2.0.20] - 2026-04-28

### תיקונים

- תיקון גופנים עבריים (Heebo font)

## [2.0.19] - 2026-04-28

### תכונות חדשות

- מערכת עדכון עצמי עם rollback אוטומטי
- בדיקת עדכונים מ-GitHub Releases
- היסטוריית עדכונים

## [2.0.18] - 2026-04-28

### שיפורים

- Layout קבוע — Sidebar וכותרת לא נגללים
- שיפורי רספונסיביות למובייל
- Bottom navigation למובייל

## [2.0.17] - 2026-04-27

### תכונות חדשות

- סיווג חכם — התאמה היסטורית + AI
- טבלת VendorMapping ללמידה מצטברת
- תיקון URL של מודל OpenRouter

## [2.0.16] - 2026-04-27

### תיקונים

- תיקון בחירת ספק AI בהגדרות — בחירה אחת בלבד

## [2.0.15] - 2026-04-27

### תכונות חדשות

- תמיכה ב-OpenRouter כספק LLM נוסף
- שכבת הפשטה ל-LLM providers

## [2.0.14] - 2026-04-26

### שיפורים

- עיצוב Glassmorphism חדש
- שיפור UI כללי

## [2.0.13] - 2026-04-26

### תכונות חדשות

- תמיכה בעסקאות מט"ח
- הצגת שער המרה ודגל מדינה
