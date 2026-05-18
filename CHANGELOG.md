# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים כאן.

## [Unreleased]

### Ops — עדכון גרסה מהממשק (`safe-update.sh`)

- **תיקון:** `git pull` נכשל על שרת פריסה ב־detached HEAD / היסטוריה מפוצלת — עבר ל־`git checkout -B main origin/main && git reset --hard origin/main` (כמו `self-update.sh` / `sync-repo-to-origin.sh`).
- לוג Git כושל נשמר ב־`update-data/build.log` לדיבוג.

## [2.0.68] - 2026-05-17

### Scraper (Yahav) — `searchByDates` / overlay sync (`hirez-v1.0.24`)

**שורש הבעיה (post-2.0.67).** אחרי viewport + diagnostics, הריצה על השרת עדיין החזירה 5 שורות בלבד — ה-overlay (933 שורות) דרס את לוגיקת ה-fork (2067 שורות) שכוללת `searchByDates` → `applyYahavDateFilterOnly` + `enforceYahavStatementLoaded` + ניווט ל־`#/main/accounts/current/`.

### שינויים

- **Overlay** `backend/scraper-overlays/.../yahav.ts` — מסונכרן 1:1 עם fork `src/scrapers/yahav.ts` (כולל `ensureYahavViewport`, `gotoYahavCurrentAccountTransactionsPage`, `enforceYahavStatementLoaded`, לוגי `YAHAV_DEBUG_DOM` לכפתור חיפוש ול-post-search DOM).
- **תלות** `israeli-bank-scrapers` / `@hirez10/israeli-bank-scrapers` → `#hirez-v1.0.24` (עדכן `package-lock.json` אחרי merge ל-fork ו־`npm install` ב־backend).
- **Lockfile / overlay** — מיושרים לתג GitHub `hirez-v1.0.24` → commit `11a68da` (קומיט `ce1b773` = לוגיקת Yahav; `11a68da` = אותו קוד + prettier + טריגר release). אימות: `node scripts/verify-scraper-lock.cjs`.
- **ScraperService** (מ-2.0.67): `detectCoverageAnomaly` קורא `partial/warnings/diagnostics`; `scraper.service.spec.ts`.

### אימות נדרש על השרת

```bash
docker compose build backend && docker compose up -d backend
docker exec -e SCRAPE_START_DATE=2026-04-25 -e SCRAPE_END_DATE=2026-05-13 \
  -e YAHAV_DEBUG_DOM=1 -e SCRAPE_ASSERT_MAY1=1 \
  finance-backend npx ts-node prisma/verify-yahav-config-scrape.ts
```

צפוי: `DOD_VERDICT.passed=true`, `dateTokenCount` ≥ 18, `SALARY_ROWS` ≥ 2.

## [2.0.67] - 2026-05-17

### Scraper (Yahav) — RCA & תיקון עומק לכיסוי 01/05

**שורש הבעיה שזוהה.** ה־postinstall של ה־backend (`scripts/ensure-israeli-bank-scrapers.cjs`) דורס את `node_modules/israeli-bank-scrapers/src/scrapers/yahav.ts` ב־overlay מקומי מתוך `backend/scraper-overlays/...`. כתוצאה מכך, כל השיפורים שמהדק שוחררו ב־fork `hirez-v1.0.21..1.0.23` (`applyYahavDateFilterOnly`, `enforceYahavStatementLoaded`, `buildYahavCoverageDiagnostics`, `partial/warnings/diagnostics`) **לא רצו בפועל** — הם נמחקו בכל `npm ci`. בנוסף, `ScraperService.detectCoverageAnomaly` לא קרא את ה־`partial/warnings/diagnostics` שהסקרייפר מחזיר. ה־lockfile למעשה תקין: ה־SHA `0e12db58a8acba7afd12e39553ce8bcc4b8c4e41` הוא בדיוק תג `hirez-v1.0.23` — גרסת `package.json` של ה־fork תקועה על "1.0.20" רק כי `@semantic-release/git` הוסר.

### Overlay (`backend/scraper-overlays/israeli-bank-scrapers/src/scrapers/yahav.ts`)

- **viewport מפורש** ב־`fetchData()` (1366×900). בדוקר headless Chromium ברירת המחדל ~800×600 והרשימה הוירטואלית מציגה רק ~5 שורות — מסביר את "5 רשומות בלבד 09–13/05".
- **`buildYahavCoverageDiagnostics` (יצוא טהור)** — מחשב `requestedStartDate / minTxnDate / maxTxnDate / txnsCount / coverageGapDays / suspiciousCoverage` ב־`Asia/Jerusalem`.
- **`readYahavListDateFootprint(page)`** — סורק את ה־DOM אחרי הסינון: סופר תאים `DD/MM/YYYY`, מאתר את התאריך הישן/חדש ביותר ומציין אם מילת שכר נראית בעמוד.
- **`collectYahavRowsByDatePatternFallback(page)`** — נקרא כאשר ה־selector הראשי מחזיר פחות מ־5 שורות; סורק כל אלמנט תחת `.list-item-holder` לפי תבנית תאריך ומוסיף שורות שהפרסר הקיים מצליח לפענח.
- **החזרה מ־`fetchData`** עכשיו מכילה `partial: boolean`, `warnings: string[]?`, `diagnostics: Record<string, unknown>` (כולל `requestedStartDate / minTxnDate / maxTxnDate / coverageGapDays / suspiciousCoverage / domFootprint / viewport`).
- **הוסר ה־cap הסמוי** ב־`fetchData`: `moment.max(today−3mo+1d, requestedStart)` קיצר בשקט בקשות שמגיעות מעבר ל־3 חודשים אחורה. עכשיו `startMoment` שווה ל־`requestedStart` (וברירת המחדל = 3 חודשים אחורה רק כש־caller לא העביר ערך).

### Backend ScraperService

- `detectCoverageAnomaly` מקבל עכשיו `scraperPartial / scraperWarnings / scraperDiagnostics` מהסקרייפר וטומן אותם ב־stats. כל `result.partial=true` מסומן כ־anomalous גם בחלון קצר — כך ש־probe scrapes לא יסתירו תקלה.
- כשהסקרייפר מחזיר `partial=true` (או יש `warnings`/`diagnostics`) — `ScraperService` מוסיף `appLogs.add('WARN','scraper','דיאגנוסטיקת סקרייפר',...)` עם `scraperConfigId`, `companyId`, `partial`, `warnings`, `diagnostics`.

### Verify (`backend/prisma/verify-yahav-config-scrape.ts`)

- מודפס `SCRAPER_DIAGNOSTICS` מלא (`partial / warnings / diagnostics`) בנוסף ל־`SCRAPE_RESULT` הקיים.
- תחת `SCRAPE_ASSERT_MAY1=1` הסקריפט מאמת `Definition of Done`: ≥18 שורות שיום הבנק שלהן `2026-05-01` (Asia/Jerusalem) **וגם** ≥2 שורות עם `description` המכיל `משכורת`/`שכר`/`salary`. כשל מחזיר exit code `2` ו־`DOD_FAILED`.

### בדיקות

- `backend/src/modules/scraper/scraper.service.spec.ts` — נעילת התנהגות `detectCoverageAnomaly` לכל 5 התרחישים (partial+נתונים דלים, חלון רחב/מעט שורות, כיסוי בריא, אפס נתונים + לא partial, אפס נתונים + partial).

## [2.0.66] - 2026-05-17

### Scraper (Yahav) — עדכון 1.0.23 ואימות חוזר

- עודכנו התלויות `israeli-bank-scrapers` וגם `@hirez10/israeli-bank-scrapers` ל־`github:HirezRa/israeli-bank-scrapers#hirez-v1.0.23`.
- עודכן `backend/package-lock.json` ל־commit החדש של fork (`0e12db58a8acba7afd12e39553ce8bcc4b8c4e41`) לקיבוע Build דטרמיניסטי.
- בוצע rebuild מלא לשירות `backend` בשרת והרצה חוזרת של `verify-yahav-config-scrape.ts` בשני טווחים:
  - `2026-05-09..2026-05-13`
  - `2026-04-25..2026-05-13`
- בשני המקרים הוחזרו 5 פעולות בלבד בטווח `2026-05-09..2026-05-13`, ללא משכורות `01/05` (`SALARY_ROWS count=0`).

## [2.0.65] - 2026-05-16

### Scraper (Yahav) — עדכון 1.0.22 ואימות חוזר

- עודכנו התלויות `israeli-bank-scrapers` וגם `@hirez10/israeli-bank-scrapers` ל־`github:HirezRa/israeli-bank-scrapers#hirez-v1.0.22`.
- עודכן `backend/package-lock.json` ל־commit החדש של fork (`51c4f05c6a50f36a320b32f05feac1d2988563ca`) לקיבוע Build דטרמיניסטי.
- בוצע rebuild מלא לשירות `backend` בשרת והרצה חוזרת של `verify-yahav-config-scrape.ts` בשני טווחים:
  - `2026-05-09..2026-05-13`
  - `2026-04-25..2026-05-13`
- בשני המקרים הוחזרו 5 פעולות בלבד בטווח `2026-05-09..2026-05-13`, ללא משכורות `01/05` (`SALARY_ROWS count=0`).

## [2.0.64] - 2026-05-16

### Scraper (Yahav) — עדכון ואימות

- עודכנה תלות `israeli-bank-scrapers` וגם `@hirez10/israeli-bank-scrapers` ל־`github:HirezRa/israeli-bank-scrapers#hirez-v1.0.21`.
- עודכן `backend/package-lock.json` ל־commit החדש של fork (`e367ca02924a88f4ce4a04e906c801fbf887692e`) כדי לקבע Build דטרמיניסטי.
- בוצע rebuild מלא של שירות `backend` על השרת והורצה בדיקת `verify-yahav-config-scrape.ts` עם `SCRAPE_START_DATE=2026-04-25` (וגם `2026-05-09`): בפועל הוחזרו רק 5 פעולות בטווח `2026-05-09..2026-05-13`, ללא משכורות 01/05 (`SALARY_ROWS count=0`).

## [2.0.63] - 2026-05-16

### אבטחה ותפעול (מאגר)

- **פריסה מרחוק:** סקריפטי `deploy_remote_guest` / rebuild / split-bills / Ollama עוברים ל־`FINANCE_DEPLOY_SSH` ואופציונלי `FINANCE_SSH_JUMP_HOST` (OpenSSH `-J`) — ללא פקודות guest-exec ספציפיות לספק וירטואליזציה במאגר.
- **GitHub Actions:** `deploy-remote.yml` ו־`push-github-deploy-settings.ps1` מעודכנים; מומלץ למחוק משתנים ישנים `FINANCE_DEPLOY_GUEST_VMID` / `FINANCE_DEPLOY_VIA_PCT` מהריפו ב-GitHub.
- **תיעוד:** `LOGGING_GUIDE.md` — הוראות עדכון מאורח Linux מנוטרלות (SSH גנרי); `docs/DEPLOYMENT.md` ו־`.github/auto-deploy-setup.md` מסונכרנים.
- **מקומי:** הוסרו סקריפטי SSH/מפתחות לדוגמה שלא היו אמורים להידחף; `.gitignore` מרחיב חסימה לתיקיית כלי MCP מקומית תחת `tools/`.
- **היסטוריית Git:** `git filter-repo` — הסרת מסמכי עיצוב וסקריפטי פריסה ישנים עם טביעות תשתית; החלפת כתובות IP פנימיות ב־placeholders בכל ההיסטוריה.
- **סריקה:** `.gitleaks.toml` מורחב (allowlists ממוקדים); `.gitleaksignore` מתחדש דרך `regen-gitleaksignore.cjs`; `verify-gitleaks-clean.cjs` ב־`run-local-security-checks`.

## [2.0.62] - 2026-05-16

### ניקוי מאגר

- הוסר תיעוד ואזכורים לתוסף MCP צד־שלישי — לא חלק מהפרויקט (קובץ תיעוד ייעודי שהוסר, קישור ב־`README`). גרסה **2.0.61** (תג GitHub) בוטלה לטובת **2.0.62**.

## [2.0.60] - 2026-05-16

### תפעול (Docker — סקריפטי Prisma)

- **אימג׳ הבאק־אנד:** העתקת `src/` ו־`tsconfig.json` לשלב הריצה — `ts-node` על `prisma/*.ts` מצליח לייבא `../src/common/utils/...` (תיקון `MODULE_NOT_FOUND` / הרצה מתוך קונטיינר).
- **`npm run heal:transaction-dates-from-raw`** — shortcut לסקריפט הריפוי.
- **תיעוד:** `docs/SALARY_EFFECTIVE_DATE.md` — `BANK_YEAR` חייב להתאים לשנה בפועל (למשל 2026); דוגמאות `docker compose exec` מ־`/app`.

## [2.0.59] - 2026-05-16

### תפעול (ריפוי נתונים — משכורות / תאריכי סנכרון)

- **`normalizeScraperDateFromRaw`** ב־`scraper-date-normalize.ts` — לוגיקת תאריך ישראל משותפת ל־`ScraperService` ולסקריפטי DB.
- **`prisma/heal-transaction-date-from-scraper-raw.ts`** — עדכון `date` / hash / `effectiveDate` (הכנסות) מ־`rawData` כשסנכרון לא תיקן רשומות לפני 2.0.58.
- **`clear-early-month-income-effective-date` / `docs/SALARY_EFFECTIVE_DATE.md`:** סדר הרצה מומלץ עם סקריפט הריפוי החדש.

## [2.0.58] - 2026-05-07

### תיקון (סנכרון — תאריכי מאי / משכורות)

- **`ScraperService`:** תאריך עסקה מחושב בלוח **אזרחי ישראל** (`formatIsraelYmdIso`, גבולות `startOfIsraelCivilDayInUtc` / `endOfIsraelCivilDayInUtc`) ל־`scraperHash`, דה־דופ רך (`duplicateSoft`), שמירת `date`, והתאמת pending — במקום `toISOString().split('T')[0]` וחלון UTC שגרמו לסטיות אחרי סקרייפר שמחזיר timestamps מלאים (כולל לעסקאות חודש מאי).
- **תיעוד:** `docs/SALARY_EFFECTIVE_DATE.md` — סעיף סנכרון סקרייפר; בדיקות `israel-calendar-format.spec.ts`.

## [2.0.57] - 2026-05-14

### תלויות (סקרייפר)

- **israeli-bank-scrapers** / **@hirez10/israeli-bank-scrapers** → תג Git [hirez-v1.0.20](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.20) (קומיט `1c9b998c230d7936c2a232aa7f2b8729a007fada`).

## [2.0.56] - 2026-05-14

### תיקון (Docker — frontend unhealthy)

- **healthcheck ל־`frontend`:** `wget --spider` לא נתמך ב־BusyBox של `nginx:alpine` — הוחלף ב־`wget -q -O /dev/null http://localhost/`. ב־`frontend/Dockerfile` נוסף `apk add wget` לוודא כלי עקבי אחרי build.

## [2.0.55] - 2026-05-13

### תיקון (Docker / nginx 502)

- **`nginx/` (reverse proxy):** תבנית `nginx.conf.template` + `docker-entrypoint.sh` בונים בזמן הרצה `resolver` מול DNS המוטבע של Docker, ו־`proxy_pass` עם משתנה ל־`backend`/`frontend` — מפחית 502 מכתובות upstream ישנות אחרי `docker compose up` שמחדש רק backend/frontend. אימג׳: `nginx/Dockerfile`.
- **`docker-compose.yml`:** healthcheck ל־`frontend`; nginx ממתין ל־`service_healthy` של frontend; שירות `nginx` נבנה מאימג׳ מקומי (`nginx/Dockerfile`) במקום `nginx:alpine` + mount קובץ קונפיג.
- **סקריפטי פריסה / עדכון:** `docker compose build` כולל גם את שירות `nginx` (`deploy_remote_guest`, `safe-update`, `self-update`, מדריכים).
- **`docs/TROUBLESHOOTING.md`:** סעיף 502 + `docker compose restart nginx`.

## [2.0.54] - 2026-05-13

### תיקון (עדכון שרת / detached HEAD)

- **ממשק גרסאות (`VersionChecker`):** פקודת העתקה ידנית כוללת `git fetch` + `git checkout main --force` + `pull` + migrate + build + `up` — מתאים למצב **detached HEAD** (למשל אחרי checkout לתג).
- **`safe-update.sh` / `self-update.sh`:** לוג לפני `docker compose up`, ו־`docker compose --progress plain up -d` כדי שלא ייראה «תקוע» ב־80% בלי פלט.
- **תיעוד:** `SELF_UPDATE_MANUAL.md`, `DEPLOYMENT.md`, `auto-deploy-setup.md`; **`rebuild_backend_guest.sh` / `rebuild_backend_remote.ps1`:** אותו סנכרון Git לפני build.

## [2.0.53] - 2026-05-13

### תפעול / אבטחה (SSH פריסה)

- **`FINANCE_SSH_STRICT_HOST_KEY_CHECKING`:** ברירת מחדל **`accept-new`** במקום `StrictHostKeyChecking=no` ב־`deploy_remote_guest.sh/.ps1`, `rebuild_backend_*`, `pull_ollama_*`, `run_split_bills_*` — מאוזן עם `ssh-keyscan` ב־GitHub Actions. תיעוד ב־`docs/DEPLOYMENT.md` ו־`.github/auto-deploy-setup.md`.
- **`deploy_remote_guest`:** זרימת פריסה אחת על המארח (git checkout/pull, migrate best-effort, build backend+frontend, up, בדיקת health מקומית).

## [2.0.52] - 2026-05-13

### תפעול (משכורת / נתונים)

- **ריפוי DB אוטומטי:** `SalaryEffectiveDateHealService` — cron יומי (03:30 UTC) מנקה `effectiveDate` מעסקאות הכנסה שיום הבנק בישראל הוא **1–14** (אותה לוגיקה כמו `computeSalaryEffectiveDateForBankDate`). ניתן לכבות: `DISABLE_SALARY_EFFECTIVE_DATE_HEAL=true`; גבול סריקה לריצה: `SALARY_EFFECTIVE_DATE_HEAL_MAX_SCAN` (ברירת מחדל 12000).

## [2.0.51] - 2026-05-13

### תיקון (משכורת מאי / דשבורד)

- **`cashFlowAnchorDateForTxn`:** להכנסה עם יום בנק בישראל **1–14**, עוגן תזרים/תקציב הוא **`date`** גם כשב־DB קיים `effectiveDate` ישן לחודש הבא — מתקן מצב שמשכורת מ־1 במאי לא הופיעה במאי בגלל נתוני legacy. יושם ב־`DashboardService`, `BudgetsService`, `CategoriesService`, `TransactionsExportService`.

## [2.0.50] - 2026-05-13

### תיקון (Docker build)

- **`backend/Dockerfile` (שלב builder):** `ENV PUPPETEER_SKIP_DOWNLOAD=1` (+ `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`) לפני `npm ci` — מונע כשל postinstall של Puppeteer (הורדת Chrome ל־`/root/.cache/puppeteer/...`) כשאין צורך בדפדפן בשלב build; ב־runtime משתמשים ב־Alpine `chromium` כמו קודם.

## [2.0.49] - 2026-05-13

### תיקון (Docker / Fastify)

- **הסרת override ל־`@fastify/middie@^9.x`:** גרסה 9 דורשת Fastify 5; אחרי נעילה ל־Fastify 4.28.1 השרת נפל עם `FST_ERR_PLUGIN_VERSION_MISMATCH` (middie מול fastify). חזרה לגרסת middie שמגיעה עם `@nestjs/platform-fastify` v10 (**8.3.x**).

## [2.0.48] - 2026-05-13

### תיקון קריטי (Docker / Fastify)

- **הסרת override ל־`fastify@5.x` + נעילה ל־4.28.1:** ה־override ל־5.8.5 שבר את `@fastify/helmet` / Nest 10 (`FST_ERR_PLUGIN_VERSION_MISMATCH`). כעת `fastify@4.28.1` כתלות ישירה + `overrides.fastify` באותה גרסה לאיחוד העץ.

## [2.0.47] - 2026-05-12

### תיקון (משכורות + תאריכים)

- **`effectiveDate` למשכורת:** לא מחשבים הזזה לחודש הבא כשיום ההפקדה בלוח ישראלי הוא **1–14** (מונע מצב שמשכורת ב־1 במאי קיבלה `effectiveDate` ביוני ונעלמה מסיכום מאי בדשבורד בגלל טווח משכורת רחב מדי כמו 1–31).
- **API `GET /transactions`:** פרמטרים `startDate` / `endDate` בפורמט `YYYY-MM-DD` מפורשים כימים **אזרחיים בישראל** (גבולות UTC מדויקים), ולא כ־UTC חצות גולמי.
- **מבנה:** `getIsraelYmd` מרוכז ב־`israel-calendar.ts`; `budget-cycle` מייבא ממנו.
- **תיעוד:** `docs/SALARY_EFFECTIVE_DATE.md`, בדיקות יחידה `salary-effective-date.spec.ts`.

### תפעול / לוגים (עדכון אוטומטי)

- **`scripts/safe-update.sh`:** בכישלון בנייה, הודעת ה־rollback כוללת נתיבים ל־`update-data/build.log` ו־`logs/update.log`.
- **`VersionService`:** בשיקוף סטטוס סופי `failed` / `rolled-back` מהמארח ללוג האפליקציה — נוספו `diagnosticPaths` ו־`buildLogTail` (זנב לוג הבנייה) כדי לאבחן בלי SSH לשרת.
- **תיעוד:** `docs/SELF_UPDATE_MANUAL.md` (עדכון מאורח), פקודות `pct` ב־`LOGGING_GUIDE.md`, הרחבת אבחון שם.
- **Docker Compose:** healthcheck ל־`backend` (כולל `start_period` למיגרציה לפני האזנה לפורט), nginx תלוי ב־`backend` במצב healthy.

## [2.0.46] - 2026-05-12

### תלויות (סקרייפר)

- **israeli-bank-scrapers** / **@hirez10/israeli-bank-scrapers** → תג Git [hirez-v1.0.19](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.19).
- **Overlay יהב** (`scraper-overlays/.../yahav.ts`) מסונכרן עם `yahav.ts` מ־upstream v1.0.19 (כולל שינויים upstream; `referenceNumber` כבר בפורק).

## [2.0.45] - 2026-05-12

### תיקון Yahav (משכורות / רשימה וירטואלית)

- **Overlay יהב**: הוחזר בסיס הקוד מ־`hirez-v1.0.18` (גלילה מלאה לרשימת תנועות וירטואלית + `yahav-parse`) — הגרסה הישנה ב־overlay דרסה את upstream וגרמה לשורות בתחתית הטווח (למשל משכורות 1/5) **לא להימשך מה-DOM**.
- **convertTransactions**: נשמר `referenceNumber` + אימות תאריך `moment(..., true)` במקום `parseInt` על אסמכתא.

### ייצוא Excel

- **מחזור תקציב**: סינון אחרי השאילתה כולל עסקה אם **`date` או `effectiveDate`** נופלים בחודש המבוקש (לא רק `effectiveDate ?? date`), כדי שלא ייעלמו משכורות ממאי בייצוא מאי כשיש `effectiveDate` בחודש הבא.

## [2.0.44] - 2026-05-12

### תלויות (סקרייפר)

- **israeli-bank-scrapers** → תג Git [hirez-v1.0.18](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.18) (`github:HirezRa/israeli-bank-scrapers#hirez-v1.0.18`, קומיט `b904bd6`). ב־`package.json` של הפורק עדיין מופיע semver פנימי `1.0.17` — מזהה השחרור הוא התג `hirez-v1.0.18`.

## [2.0.43] - 2026-05-12

### תיקון סנכרון (Yahav / dedup)

- **יהב (overlay)**: אסמכתא ב־`referenceNumber` לייצוב רכיב ה־hash של `scraperHash` (במקום הסתמכות על `identifier` מ־`parseInt` בלבד).
- **`ScraperService`**: חישוב hash ומזהה לשמירה — `referenceNumber ?? identifier`; לוג `DEBUG` `duplicate_skipped_existing_scraper_hash` כשדילוג על עסקה קיימת לפי אותו hash (מצב completed).

## [2.0.42] - 2026-05-11

### לוגים ואבחון (סנכרון / עדכון גרסה)

- **גרסת סקרייפר ודפדפן**: מילוי `scraperGitSha` (env / `.git` / `package-lock`) ו־`browserVersion` (env / `chromium --version`).
- **שגיאות סנכרון**: `errorFull` / `errorCause` / `stackHead` עקביים; רמז כשאין אבחון Puppeteer מהחבילה; redaction למחרוזות חיבור ב־meta.
- **ייצוא**: `GET /logs/export?preset=diagnostic` — פחות רעש (sync/scraper/version/update + WARN/ERROR); כפתור בהגדרות.
- **עדכון גרסה**: רישום טריגר מפורט; שיקוף כישלון/rollback מ־`.update-status.json` ללוג האפליקציה.
- **תיעוד**: [`docs/SELF_UPDATE_MANUAL.md`](docs/SELF_UPDATE_MANUAL.md), עדכון [`LOGGING_GUIDE.md`](LOGGING_GUIDE.md).

## [2.0.41] - 2026-05-10

### תיקון עדכון עצמי (runtime)

- **`VersionService`**: אם בקונטיינר הגיעו ערכים ישנים `UPDATE_DATA_DIR=/app/update-data` יחד עם `APP_DIR=/opt/finance-app`, הנתיב מתוקן אוטומטית ל־`/opt/finance-app/update-data` (לוג אזהרה). כך הטריגר מגיע ל־host גם כש־Portainer / stack / compose לא עודכנו.

## [2.0.40] - 2026-05-10

### תיקון עדכון עצמי (שרת)

- **`docker-compose.yml`**: `APP_DIR` ו־`UPDATE_DATA_DIR` ל־backend מוגדרים עכשיו כערכים **קבועים** (לא דרך `${...}` מקובץ `.env`), כדי ששורה ישנה כמו `UPDATE_DATA_DIR=/app/update-data` על השרת לא תגרום לכתיבת הטריגר מתחת ל־`/app/...` בקונטיינר — מצב שבו הקובץ לא מופיע ב־`/opt/finance-app/update-data/` על ה-host.
- **`install-updater.sh`**: יוצר `update-data` על ה-host ו־`chmod 777` לפני הפעלת systemd (כתיבה ע"י `nestjs` UID 1001).
- **לוג אתחול**: כש־`SELF_UPDATE_ENABLED=true`, נרשמים נתיבי הטריגר ל־לוג לניפוי תקלות.

## [2.0.39] - 2026-05-10

### תיקון עדכון עצמי (Docker)

- **`UPDATE_DATA_DIR`**: ברירת המחדל ב־`docker-compose` הייתה `/app/update-data` בעוד ש־`systemd` (`finance-app-updater.path`) מחכה ל־`/opt/finance-app/update-data/.update-requested` על ה-host — הטריגר לא הגיע למארח והעדכון נשאר `pending`. כעת הנתיב וה-volume מיושרים ל־`/opt/finance-app/update-data` (ראו `.env.example`).

## [2.0.38] - 2026-05-10

### תיקון UI (עסקאות)

- **תאריך בשורה:** מוצג תאריך הבנק (`date`), כדי שמשכורות ותנועות יופיעו באותו חודש כמו בדף החשבון. עסקאות הכנסה עם **תאריך אפקטיבי לתקציב** (`effectiveDate`, למשל משכורת בסוף החודש) מציגות השלמה · **בתקציב:** … במקום להציג רק את חודש ייחוס התקציב.

### סקרייפר Yahav

- הוסר פאץ’ `patch-package` גדול על `israeli-bank-scrapers`; במקום זה — **overlay** ב־`backend/scraper-overlays/.../yahav.ts` שמוחל אחרי clone/`build:js` ב־`ensure-israeli-bank-scrapers.cjs` (כולל דוקר). כדאי להזין את אותו תוכן ל־fork כשמתאימים ל־upstream.

## [2.0.36] - 2026-05-09

### שדרוג תלות סקרייפר

- **israeli-bank-scrapers** → [hirez-v1.0.15](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.15) (commit `ca59b62` — יישור `package-lock` עם ה־tag).

## [2.0.35] - 2026-05-08

### שדרוג תלות סקרייפר

- **israeli-bank-scrapers** → [hirez-v1.0.14](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.14) — commit lockfile `2daeb3b` (ריענון תלויות/foram ב-fork, typescript-eslint ועוד; ראו release upstream).

### עדכון תלויות npm (בטווח semver קיים)

- **Backend:** `npm update` — למשל `@nestjs/*` 10.4.x, `@prisma/client` / `prisma` 5.22.x, `bull` 4.16.x, `ioredis` 5.10.x, `class-validator` 0.14.x, `@types/node` 20.19.x (ללא קפיצה ל-Nest 11 / Prisma 7).
- **Frontend:** `npm update` — למשל `@tanstack/react-query` 5.100.x, `axios` 1.16.x, רכיבי `@radix-ui/*` ופוסט־פרוססורים בעדכוני patch/minor בתוך הטווח ב-`package.json`.

### תיעוד ריצה

- ראו `docs/RELEASE_2.0.35.md` — פירוט צעדים, גרסאות, ואימות CI/פריסה.

## [2.0.34] - 2026-05-08

### אבטחה ותיעוד

- **תיעוד ציבורי:** הסרת דפוסי תשתית (ספקי וירטואליזציה, דוגמאות RFC1918, מונחים מיותרים) מ־`docs/` ו־`.github/auto-deploy-setup.md`.
- **סקריפטים:** פריסה מרחוק מאוחדת תחת `deploy_remote_guest.sh`; שמות קבצים ניטרליים (`full_stack_update_remote`, `rebuild_backend_guest`, וכו'); תיקון עטיפות שפנו לקבצים ישנים.
- **CI:** `scripts/verify-public-docs-safety.cjs` — אותה בדיקה כמו ב-workflow, להרצה מקומית לפני push.

## [2.0.33] - 2026-05-07

### טכני (ניהול גרסאות)

- יישור שדות `version` ב־`frontend/package.json` ו־`backend/package.json` (וה־lockfiles) עם גרסת המוצר; עדכון `docs/CHANGELOG.md` מול `CHANGELOG.md` בשורש.

## [2.0.32] - 2026-05-07

### שיפורים (סקרייפר)

- **israeli-bank-scrapers** עודכן ל־[hirez-v1.0.12](https://github.com/HirezRa/israeli-bank-scrapers/releases/tag/hirez-v1.0.12) (תיקון Yahav date-picker ועוד).
- **`ensure-israeli-bank-scrapers`**: שכפול ref מ־`package.json`, חותמת דילוג כשה־ref לא השתנה, ו־`git fetch`/`checkout` בעת שדרוג תג — מונע סנכרון שקט ל־`master` או lib ישן אחרי bump.

## [2.0.31] - 2026-05-07

### שיפורים (לוגים וסנכרון)

- **Structured logging** לסנכרון: `syncRunId`, מזהי job/config/user, שלבי lifecycle (`sync_start` … `sync_end`), טקסונומיית שגיאות (`errorKind` / `errorFingerprint`), מדדי עסקאות וחשבונות, תור Bull ו-runtime (גרסת אפליקציה, תלות סקרייפר, Node, Chromium אופציונלי).
- **Partial sync**: כשל בחשבון בודד לא עוצר את שאר החשבונות; `status=partial` ב־`sync_end` כשמתאים.
- **פרטיות**: הרחבת sanitization ב־`LogsService` (OTP, cookies, tokens, מסכות ל־URL/חשבון).
- **תיעוד**: `LOGGING_GUIDE.md` (סכמה, דוגמאות trace, שאילתות).
- **Docker / פריסה**: משתני סביבה אופציונליים `SCRAPER_GIT_SHA`, `CHROMIUM_VERSION` ב־`docker-compose` ו־`.env.example`.

## [2.0.28] - 2026-04-30

### שיפורים (UI)

- ערכת **Liquid Glass** — משטחי זכוכית, טשטוש, שקיפויות, גרדיאנטים עדינים; כרטיסים ושדות מעודכנים

### תיקונים (אימות / עדכונים)

- **401 Unauthorized:** מיירטור תגובות — ניסיון **רענון JWT** דרך `POST /api/v1/auth/refresh` לפני ניתוק; שמירת `refreshToken` ב־Zustand (persist)
- **לוג בשרת:** קוד 401 בלוג API עבר מ־**WARN** ל־**DEBUG** (בקשות ללא/עם מזהה פגי תוקף)
- **UpdateSection** / **VersionChecker:** בדיקות גרסה / סטטוס עדכון **רק אם מחובר** — מפחית 401 בלוגים

## [2.0.27] - 2026-04-29

### תיקונים

- **עמוד עסקאות:** סרגל הפעולות מציג כעת רק **סיווג מהיר** ו־**סיווג חכם** (מודאל `CategorizationModal` עם `launchWith`); הוסרו כפתורי Ollama הנפרדים (אוטומטי / מתקדם). **סווג מחדש** הועבר לתפריט **עוד**.

## [2.0.26] - 2026-04-29

### שיפורים

- צמצום כפתורי סיווג ל־**מהיר** / **חכם** — `POST /categorization/smart` (מיפוי + היסטוריה + AI במנות)
- סיווג AI ב־**מנות** (10 עסקאות, השהיה 500ms) עם prompt אצווה אחד לכל מנה
- **`SecretInput`** — הסתרת מפתח API / סיסמה / טוקן; שימוש ב־AI ובהוספת חשבון
- **הגדרות LLM:** `hasOpenRouterKey` ב־API (לצד `configured`)
- **עדכונים:** לוג בנייה מוצג יחד עם פס התקדמות (כולל `pending`), מצב ריק עד קבלת לוג; ביטול עדכון גם ב־`in-progress` עד 50% + ניקוי trigger ו־build log
- **`safe-update.sh`:** `check_cancelled` בין שלבים (מחיקת trigger = יציאה בשקט)

### תיקונים

- סיווג מהיר עם רשימת `transactionIds` מסנכרן כעת רק עסקאות שעדיין דורשות קטגוריה

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
