# תיעוד שחרור 2.0.69 (2026-05-18)

## מספרי גרסה

| רכיב | ערך |
|------|-----|
| מוצר | **2.0.69** — `VERSION`, `frontend/package.json`, `backend/package.json`, lockfiles |
| תג Git | **v2.0.69** |
| תמונות Docker | rebuild `backend`, `frontend`, `nginx` (מעתיקים `VERSION` ב-build) |

## תקציר

1. **מסך עסקאות** — מעבר מ-flex ל-CSS Grid; עמודת סכום קבועה ב-RTL; הפרדת כותרת / תגיות / מטא-דאטה.
2. **Yahav scraper** — איסוף שורות מטבלה קלאסית כשה-virtual list דל.
3. **דשבורד** — תיקון הסתרת משכורות בגלל `isExcludedFromCashFlow`.

## אימות גרסה מקומי

```bash
node scripts/verify-version-align.cjs
node scripts/verify-scraper-lock.cjs
```

## פריסה (שרת / קונטיינר)

```bash
git pull origin main
docker compose build --no-cache backend frontend nginx
docker compose up -d
```

אימות API:

```bash
curl -s http://localhost/api/v1/health | jq .version
# צפוי: 2.0.69
```

אופציונלי — עדכון מהממשק: הגדרות → עדכון גרסה (`safe-update.sh`).
