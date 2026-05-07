# תיעוד שחרור 2.0.35 (2026-05-08)

מסמך ריצה פנימי: גרסאות, צעדים שבוצעו, ואיך לאמת ב-CI ובשרת היישום.

## מספרי גרסה (מקור אמת)

| רכיב | ערך |
|------|-----|
| מוצר (אפליקציה) | **2.0.35** — `VERSION`, `frontend/package.json`, `backend/package.json`, שורש `package-lock.json` בשניהם |
| תג Git הצפוי | **v2.0.35** |
| תוסף סנכרון (fork) | **hirez-v1.0.14** — `backend/package.json` → `github:HirezRa/israeli-bank-scrapers#hirez-v1.0.14` |
| Git commit נעול (lockfile) | **2daeb3b85436e1ad46b25fc7b014c11cdf134b8d** |

## הערות release upstream (סקרייפר)

לפי GitHub Releases ב־`HirezRa/israeli-bank-scrapers` עבור `hirez-v1.0.14`: ריענון lockfile, הרמת רצפי גרסאות (floors), יישור `typescript-eslint` ותיקוני תלות (PR #24).

## צעדי עבודה שבוצעו במאגר

1. עדכון סרגל התלות של `israeli-bank-scrapers` ל־`hirez-v1.0.14` והרצת `npm install` + `ensure-israeli-bank-scrapers` (בניית `lib`).
2. `npm update` ב־`backend/` ו־`frontend/` — רק בתוך טווחי ה־semver המוגדרים ב־`package.json` (ללא מעבר ל-Nest 11 / Prisma 7 / React 19 וכו').
3. בדיקות מקומיות: `npm run build` + `npm test` ב-backend, `npm run build` ב-frontend.
4. בדיקות מקומיות: `node scripts/verify-version-align.cjs`, `node scripts/verify-public-docs-safety.cjs`.
5. קומיט, דחיפה ל־`main`, תג `v2.0.35`.

## דוגמאות גרסאות אחרי `npm update` (ייצוג)

**Backend (דגימה):** `@nestjs/common` 10.4.22, `@prisma/client` 5.22.0, `bull` 4.16.5, `ioredis` 5.10.1, `class-validator` 0.14.4.

**Frontend (דגימה):** `@tanstack/react-query` 5.100.9, `axios` 1.16.0, `@radix-ui/*` בעדכונים אחרונים בתוך הטווח, `postcss` 8.5.14, `autoprefixer` 10.5.0.

## CI ב-GitHub

לאחר הדחיפה, workflow **CI Security and Build** (`.github/workflows/ci-security.yml`) אמור:

- `version-align`, `docs-public-safety`, `secret-scan`, `build` (backend + frontend).

בדיקה ידנית:

```bash
gh run list --workflow="CI Security and Build" --limit 3
```

## פריסה לשרת האפליקציה (Linux / Docker)

העדכון בפועל על השרת **אינו** מתבצע אוטומטית מסביבת הפיתוח ב-AI. אחרי `git pull` על השרת:

- מומלץ: `scripts/deploy_remote_guest.sh` (או PowerShell מקביל), או workflow **Deploy remote stack** אם ה-runner מגיע ליעד ה-SSH.

אופציונלי ב־`.env` על השרת ללוגים מובנים: `SCRAPER_GIT_SHA=2daeb3b85436e1ad46b25fc7b014c11cdf134b8d`.

אימות אחרי פריסה:

- `GET /api/v1/health` — תקין.
- גרסה בממשק / API: גירסת ליבה **2.0.35**, מספר תוסף **hirez-v1.0.14**.
