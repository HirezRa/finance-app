# Changelog

כל השינויים המשמעותיים בפרויקט מתועדים כאן.

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
