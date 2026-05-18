# תיעוד שחרור 2.0.68 (2026-05-17)

מסמך ריצה פנימי: גרסאות, צעדים שבוצעו, ואיך לאמת ב-CI ובשרת היישום.

## מספרי גרסה (מקור אמת)

| רכיב | ערך |
|------|-----|
| מוצר (אפליקציה) | **2.0.68** — `VERSION`, `frontend/package.json`, `backend/package.json`, שורש `package-lock.json` בשניהם |
| תג Git הצפוי | **v2.0.68** |
| ענף פיתוח | `fix/yahav-2.0.68-overlay-sync` |
| תוסף סנכרון (fork) | **hirez-v1.0.24** — `backend/package.json` → `github:HirezRa/israeli-bank-scrapers#hirez-v1.0.24` |
| Git commit נעול (lockfile) | **11a68da3751f580947e9acb83db8abb3eb54ce05** (= תג GitHub `hirez-v1.0.24`) |
| קומיט לוגיקת Yahav | **ce1b773** — viewport + `searchByDates` debug (לפני טריגר semantic-release) |

### יישור lockfile ↔ תג סקרייפר

`package.json` מצהיר `#hirez-v1.0.24`. ב-GitHub התג מצביע על **`11a68da`** (לא `ce1b773` המקומי הישן). `package-lock.json` וה-overlay חייבים להתאים ל־`git ls-remote` של התג.

```bash
node scripts/verify-scraper-lock.cjs   # lockfile SHA === refs/tags/hirez-v* ב-GitHub
node scripts/verify-version-align.cjs  # VERSION === package.json
```

## תקציר שינוי (Yahav)

אחרי 2.0.67 (viewport + diagnostics), הריצה על השרת עדיין החזירה 5 שורות בלבד — ה-overlay המקומי (`backend/scraper-overlays/.../yahav.ts`) דרס את לוגיקת ה-fork שכוללת `searchByDates` → `applyYahavDateFilterOnly` + `enforceYahavStatementLoaded` + ניווט ל־`#/main/accounts/current/`.

ב־2.0.68 ה-overlay מסונכרן 1:1 עם fork `src/scrapers/yahav.ts` והתלות עודכנה ל־`hirez-v1.0.24`.

## צעדי עבודה שבוצעו במאגר

1. סנכרון overlay Yahav עם fork `hirez-v1.0.24`.
2. עדכון `israeli-bank-scrapers` / `@hirez10/israeli-bank-scrapers` + `package-lock.json`.
3. `ScraperService.detectCoverageAnomaly` — קריאת `partial/warnings/diagnostics` + `scraper.service.spec.ts`.
4. יישור SemVer: `VERSION`, frontend/backend `package.json`, lockfile roots → **2.0.68**.
5. קומיט על `fix/yahav-2.0.68-overlay-sync`, מיזוג ל־`main`, תג `v2.0.68`.

## אימות נדרש על השרת

```bash
docker compose build backend && docker compose up -d backend
docker exec -e SCRAPE_START_DATE=2026-04-25 -e SCRAPE_END_DATE=2026-05-13 \
  -e YAHAV_DEBUG_DOM=1 -e SCRAPE_ASSERT_MAY1=1 \
  finance-backend npx ts-node prisma/verify-yahav-config-scrape.ts
```

צפוי: `DOD_VERDICT.passed=true`, `dateTokenCount` ≥ 18, `SALARY_ROWS` ≥ 2.

## CI ב-GitHub

לאחר הדחיפה, workflow **CI Security and Build** אמור לעבור:

- `version-align`, `scraper-lock`, `docs-public-safety`, `secret-scan`, `build`.

```bash
gh run list --workflow="CI Security and Build" --limit 3
node scripts/verify-version-align.cjs
```

## פריסה לשרת האפליקציה

אחרי `git pull` על השרת (או `scripts/safe-update.sh` / `deploy_remote_guest`):

- rebuild `backend` (postinstall מריץ overlay).
- אופציונלי: `SCRAPER_GIT_SHA=11a68da3751f580947e9acb83db8abb3eb54ce05` ב־`.env`.

אימות: גרסת ליבה **2.0.68**, תוסף **hirez-v1.0.24**.
