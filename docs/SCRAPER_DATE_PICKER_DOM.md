# סנכרון — תקלת בורר תאריך (DOM)

## מה קרה

בלוגים פנימיים (`category: sync` / `scraper`) הופיעה שגיאת Puppeteer:

`Waiting for selector 'div.date-options-cell:nth-child(7) > date-picker:...' failed`

הסנכרון נכשל אחרי ~33 שניות — זמן המתנה טיפוסי ל־timeout של בורר.

## שורש הבעיה

ב־[HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (וב־upstream eshaham), לאחר `build:js`, אחד מסקרייפרי הדפדפן משתמש בלוח שנה לתאריך **התחלה** של טווח פעולות. הבורר היה תלוי ב־`nth-child(7)` קבוע בשורת מסננים.

כשממשק האתר של המוסד משנה את ה־DOM, המספור נשבר — ללא קשר לאימות.

## התיקון בפרויקט Finance App

1. **תלות**: `github:HirezRa/israeli-bank-scrapers` עם commit מנוהל ב־`package-lock.json` (שם החבילה ב־fork: `@hirez10/israeli-bank-scrapers`). ענף ברירת המחדל ב־GitHub הוא **`master`** (לא `main`).

2. **בניית `lib`**: התקנת npm מ־Git שולחת ארטיפקט דליל. הסקריפט `backend/scripts/ensure-israeli-bank-scrapers.cjs` (ב־`postinstall`) מבצע `git clone --depth 1` של ה־fork ואז `npm run build:js` בתיקייה.

3. **תיקון Yahav**: רוב השינויים ב־`src/scrapers/yahav.ts` מגיעים מה־tag ב־[HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (בורר תאריך גמיש וכו'). **פרסור שורות טבלה** (תאריכים כפולים, חובה/זכות דינמיים) מוחל אחרי `build:js` מקובץ overlay בפרויקט: `backend/scraper-overlays/israeli-bank-scrapers/src/scrapers/yahav.ts`, באמצעות `ensure-israeli-bank-scrapers.cjs` (השוואת תוכן ל־`node_modules/.../yahav.ts` — ריענון אוטומטי אחרי `git checkout` של ה־fork). **לא** משתמשים ב־`patch-package` על כל חבילת הסקרייפר (הדיפ מול התקנה רזה מייצר קובץ ענק ובלתי ניתן לתחזוקה).

4. **Docker**: ב־`backend/Dockerfile` מועתקים `scripts/`, `patches/` ו־`scraper-overlays/` לפני `npm ci` כדי ש־`postinstall` יריץ ensure + overlay.

5. **סיווג שגיאות**: ב־`ScraperService.classifyScraperError`, מחרוזות `waiting for selector` מסווגות כ־`parse`.

## אימות אחרי פריסה

- סנכרון ידני לחשבון מחובר מהאפליקציה.
- וידוא שבלוגים אין את בורר ה־`nth-child(7)` המקורי.

## תרומה ל־upstream

אפשר לפתוח PR ל־[eshaham/israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) עם אותו שינוי ב־`src/scrapers/yahav.ts` אם עדיין לא סונכרן מה־fork.
