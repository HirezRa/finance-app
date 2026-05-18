# תיעוד שחרור 2.0.68 (2026-05-17)

מסמך ריצה פנימי: גרסאות, צעדים שבוצעו, ואיך לאמת ב-CI ובשרת היישום.

## מספרי גרסה (מקור אמת)

| רכיב | ערך |
|------|-----|
| מוצר (אפליקציה) | **2.0.68** — `VERSION`, `frontend/package.json`, `backend/package.json`, שורש `package-lock.json` בשניהם |
| תג Git הצפוי | **v2.0.68** |
| ענף פיתוח | `fix/yahav-2.0.68-overlay-sync` |
| תוסף סנכרון (fork) | **hirez-v1.0.24** — `backend/package.json` → `github:HirezRa/israeli-bank-scrapers#hirez-v1.0.24` |
| Git commit נעול (lockfile) | **ce1b773f8c9dc7d9a0bb36472b74f8b09d7574e1** |

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

- `version-align`, `docs-public-safety`, `secret-scan`, `build`.

```bash
gh run list --workflow="CI Security and Build" --limit 3
node scripts/verify-version-align.cjs
```

## פריסה לשרת האפליקציה

אחרי `git pull` על השרת (או `scripts/safe-update.sh` / `deploy_remote_guest`):

- rebuild `backend` (postinstall מריץ overlay).
- אופציונלי: `SCRAPER_GIT_SHA=ce1b773f8c9dc7d9a0bb36472b74f8b09d7574e1` ב־`.env`.

אימות: גרסת ליבה **2.0.68**, תוסף **hirez-v1.0.24**.
