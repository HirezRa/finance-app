# בנק יהב — תקלת בורר תאריך בסנכרון

## מה קרה

בלוגים פנימיים (`category: sync` / `scraper`) הופיעה שגיאת Puppeteer:

`Waiting for selector 'div.date-options-cell:nth-child(7) > date-picker:...' failed`

הסנכרון נכשל אחרי ~33 שניות — זמן המתנה טיפוסי ל־timeout של בורר.

## שורש הבעיה

ב־[HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) (וב־upstream eshaham), בקובץ `lib/scrapers/yahav.js` לאחר `build:js`, פונקציה `searchByDates` פותחת את לוח השנה לתאריך **התחלה** עם בורר שמניח שהתא הוא **בדיוק** `nth-child(7)` בשורת המסננים.

כשבנק יהב משנה את ה־DOM, המספור נשבר — ללא קשר לאימות.

## התיקון בפרויקט Finance App

1. **תלות**: `github:HirezRa/israeli-bank-scrapers` (גרסת החבילה ב־fork: `1.0.9`, שם npm פנימי `@hirez10/israeli-bank-scrapers`). Upstream המסומן ב־`upstreamSync` של ה־fork הוא **eshaham v6.7.4** — לא משתמשים ישירות בחבילת npm של eshaham.

2. **בניית `lib`**: התקנת npm מ־Git שולחת ארטיפקט דליל (שדה `files` ב־`package.json` של ה־fork). הסקריפט `backend/scripts/ensure-israeli-bank-scrapers.cjs` (ב־`postinstall`) מבצע `git clone` רדוד של ה־fork ואז `npm run build:js` בתיקייה.

3. **patch-package**: `backend/patches/israeli-bank-scrapers+1.0.9.patch` מחליף את הבורר ל:

   `div.date-options-cell date-picker > div:nth-child(1) > span:nth-child(2)`

   (בורר התאריך הראשון בסדר ה־DOM — בדרך כלל "מתאריך").

4. **Docker**: ב־`backend/Dockerfile` מותקן `git` בשלב ה־builder; מועתקים `scripts/` ו־`patches/` לפני `npm ci` כדי ש־`postinstall` יריץ ensure + patch.

5. **סיווג שגיאות**: ב־`ScraperService.classifyScraperError`, מחרוזות `waiting for selector` מסווגות כ־`parse`.

## אימות אחרי פריסה

- סנכרון ידני לחשבון יהב.
- וידוא שבלוגים אין את בורר ה־`nth-child(7)` המקורי.

## תרומה ל־upstream

אפשר לפתוח PR גם ל־[eshaham/israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) וגם להציע את אותו שינוי ב־[HirezRa/israeli-bank-scrapers](https://github.com/HirezRa/israeli-bank-scrapers) ב־`src/scrapers/yahav.ts` כדי להסיר תלות ב־patch מקומי.
