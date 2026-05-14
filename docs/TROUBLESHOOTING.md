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

## 502 Bad Gateway מול nginx אחרי `docker compose up`

**תסמינים:** הדפדפן מציג `502 Bad Gateway` מ־nginx, לעיתים זמן קצר אחרי build או משיכת קוד, גם כש־`docker compose ps` מראה שירותים ב־Up.

**סיבות נפוצות:**

1. **כתובת IP ישנה אחרי יצירה מחדש של קונטיינרים** — קונטיינר ה־nginx לא נוצר מחדש ועדיין מצביע ל־IP ישן של `frontend` או `backend` ברשת הפנימית של Docker.
2. **הפרונטנד עדיין בעלייה** — nginx כבר מקבל בקשות לפני שה־frontend באמת עונה.

**פתרון מיידי (על המארח, מתיקיית הפרויקט):**

```bash
docker compose ps
docker compose logs --tail=80 nginx
docker compose logs --tail=80 frontend
docker compose restart nginx
```

**בגרסאות קוד עדכניות:** שכבת nginx נבנית מאימג׳ מקומי (`nginx/Dockerfile`) עם `resolver` דינמי ו־`proxy_pass` עם משתנה (ראו `nginx/nginx.conf.template`), וב־`docker-compose.yml` יש healthcheck ל־`frontend` ו־`depends_on` של nginx על `frontend` בריא — כדי להפחית 502 אחרי deploy.

## מטמון דפדפן (Frontend)

אחרי פריסה: רענון קשיח (Ctrl+F5), ניקוי cache, או חלון גלישה בסתר — אם הממשק לא מציג שדות/כפתורים חדשים למרות אימג׳ frontend מעודכן.

## פקודות אבחון מהירות

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=50 frontend
curl -sS --max-time 10 http://localhost/api/v1/health
```

### רשימת משכורות / הכנסות מה־DB (סקריפט)

**מומלץ בפריסת Docker** (הקוד על המארח ב־`/opt/finance-app`, משתני DB כבר בקונטיינר):

```bash
cd /opt/finance-app
node scripts/list-salary-via-docker.cjs --all-income
```

או מתוך `backend/` (אחרי `git pull`):

```bash
cd /opt/finance-app/backend
npm run list:salary-txns:docker -- --all-income
```

אופציונלי (דורש `chmod` + קובץ `.sh` אחרי `git pull`):

```bash
chmod +x scripts/list-salary-via-docker.sh scripts/list-salary-txns.sh
./scripts/list-salary-via-docker.sh --all-income
```

אם **אין** את הקבצים תחת `scripts/` (לא משכת עדיין קוד) — העתק שורה אחת:

```bash
cd /opt/finance-app && docker compose exec -T backend sh -c 'cd /opt/finance-app/backend && export NODE_PATH=/app/node_modules && exec /app/node_modules/.bin/ts-node prisma/list-salary-transactions.ts "$@"' sh --all-income
```

אל תריצו `cd /app && npx ts-node …` — תחת `/app/prisma` יש רק מה שנארז באימג׳; הקבצים העדכניים ב־`/opt/finance-app/backend/prisma`, ו־`npx` עלול לייצר `MODULE_NOT_FOUND`.

**על המארח** (דורש `npm install` תחת `backend/`). `DATABASE_URL` נטען אוטומטית מ־`prisma/.env`, `backend/.env` או `.env` בשורש הריפו:

```bash
./scripts/list-salary-txns.sh --all-income
```

ידנית מתוך `backend/`:

```bash
npm run list:salary-txns -- --all-income
```

---

[CONFIGURATION.md](./CONFIGURATION.md) · [INSTALLATION.md](./INSTALLATION.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [CREDIT_CARD_CHARGES.md](./CREDIT_CARD_CHARGES.md)
