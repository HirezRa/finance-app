# פתרון בעיות

בעיות נפוצות ב-Docker Compose והפתרונות המומלצים.

## Chromium / Puppeteer (סקרייפר)

**תסמינים:** `namespace`, `zygote`, Operation not permitted, סקרייפר נכשל.

**פתרון:**

1. `docker-compose.yml` — `backend.security_opt: seccomp:unconfined` (אם מוגדר בפרויקט).
2. `scraper.service.ts` — ארגומנטים לדפדפן: `--no-sandbox`, `--disable-setuid-sandbox`, `--no-zygote`, וכו'.

מדריך מפורט: [SCRAPER_CHROMIUM_DOCKER.md](./SCRAPER_CHROMIUM_DOCKER.md)

**הערה:** בהרצת Docker בתוך סביבות וירטואליות או קונטיינרים מקוננים, לעיתים נדרשות הגדרות נוספות ברמת המארח (למשל הרפיית AppArmor או nesting) — ראו את המדריך לעיל.

## Prisma P3015 — תיקיית מיגרציה ריקה

**תסמינים:** `Error P3015: Could not find the migration file at ...` או כשל `migrate deploy` אחרי העתקת קבצים.

**סיבות נפוצות:** תיקייה ריקה תחת `prisma/migrations`.

**פתרון** (מתוך תיקיית הפרויקט בשרת):

```bash
find backend/prisma/migrations -type d -empty -delete
```

או בתוך קונטיינר backend:

```bash
docker exec finance-backend find /app/prisma/migrations -type d -empty -delete
```

ואז:

```bash
docker compose exec -T backend npx prisma migrate deploy
```

## כפילויות עסקאות

**ניקוי שורות כפולות (סקריפט קיים):**

```bash
docker compose exec -T backend npx ts-node prisma/cleanup-duplicates.ts
```

**מניעה:** `scraperHash` ייחודי, התאמת pending→completed, `unique_transaction` על `[accountId, date, amount, description]`. ראו [PENDING_TRANSACTIONS.md](./PENDING_TRANSACTIONS.md).

## קובץ חסר בקונטיינר אחרי build

**תסמינים:** `Cannot find module '.../fix-credit-charges.ts'` או קוד ישן רץ אחרי deploy.

**סיבה:** הקונטיינר לא נוצר מחדש מהאימג׳ החדש.

**פתרון:**

```bash
docker compose up -d --force-recreate backend
# או docker compose down && docker compose up -d
```

## Prisma על Alpine

נדרש `binaryTargets` עם `linux-musl-openssl-3.0.x` ב־`schema.prisma` ו־`openssl` ב־Dockerfile של ה־backend.

## נקודת כניסה Node

הקונטיינר מריץ `node dist/src/main.js`. אם מריצים ידנית — לוודא נתיב תואם ל־`nest-cli.json` / הפלט בפועל.

## CRLF בסקריפטים

```bash
sed -i 's/\r$//' script.sh
```

## Dashboard / תקציב 0

בדוק טווח חודש (לוח ישראלי מול UTC), לוגים, ושדה `effectiveDate` להכנסות. ראו [SALARY_SETTINGS.md](./SALARY_SETTINGS.md).

## keywords כ-JSON

פרסור גמיש בקטגוריות; שמור מערך מחרוזות תקין ב־`keywords`.

## Redis

בעיות זיכרון/התראות:

```bash
echo "vm.overcommit_memory=1" >> /etc/sysctl.conf && sysctl -p
```

## מטמון דפדפן (Frontend)

אחרי פריסה: רענון קשיח (Ctrl+F5), ניקוי cache, או חלון גלישה בסתר — אם הממשק לא מציג שדות/כפתורים חדשים למרות אימג׳ frontend מעודכן.

## פקודות אבחון מהירות

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=50 frontend
curl -sS --max-time 10 http://127.0.0.1/api/v1/health
```

---

[CONFIGURATION.md](./CONFIGURATION.md) · [INSTALLATION.md](./INSTALLATION.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [CREDIT_CARD_CHARGES.md](./CREDIT_CARD_CHARGES.md)
