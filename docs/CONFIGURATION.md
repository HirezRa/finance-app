# הגדרות

## קובץ `.env` (שורש הפרויקט)

המקור לדוגמה: `.env.example`. **אל תעלה `.env` ל-Git.**

### מסד נתונים ו-Redis

```env
POSTGRES_USER=finance
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=finance_app
DATABASE_URL=postgresql://finance:CHANGE_ME_STRONG_PASSWORD@db:5432/finance_app
REDIS_URL=redis://redis:6379
```

### JWT

```bash
openssl rand -hex 32
```

```env
JWT_SECRET=<64_hex_chars>
JWT_REFRESH_SECRET=<64_hex_chars>
```

בקוד (`auth.module.ts`): זמן חיים של access token הוא **15 דקות**. משך ה-refresh נקבע בשירות האימות (cookie).

### הצפנה (`ENCRYPTION_MASTER_KEY`)

משמש להצפנת אישורי סנכרון בנק. **החלף** בערך תקין לפי הוולידציה באפליקציה (אורך hex של 32 בתים).

### שרת

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=http://localhost
```

`PORT` — פורט ה-backend **בתוך Docker**; nginx מפנה אל `backend:3000`.

### OLLAMA (אופציונלי)

```env
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=
OLLAMA_MODEL=mistral
OLLAMA_TIMEOUT=30000
```

### n8n ב-env (אופציונלי)

```env
N8N_ENABLED=false
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

Webhook לפי משתמש: `UserSettings` (ממשק UI) — `N8nWebhookService`.

### SMTP וספים

```env
SMTP_ENABLED=false
LARGE_EXPENSE_THRESHOLD=500
DAILY_SYNC_CRON=0 6 * * *
```

---

## docker-compose.yml

| שירות | פורטים | תיאור |
|--------|--------|--------|
| nginx | 80, 443 | API + UI |
| frontend | פנימי | React build |
| backend | פנימי | NestJS |
| db | פנימי | PostgreSQL 16 |
| redis | פנימי | Redis 7 |
| bull-board | 3001 (host) | UI ל-Bull |

### Backend ו-Chromium

```yaml
backend:
  security_opt:
    - seccomp:unconfined
```

ב-Dockerfile: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`, `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`.

---

## Prisma

- `backend/prisma/schema.prisma`
- `binaryTargets` כולל `linux-musl-openssl-3.0.x` ל-Alpine.

```bash
docker compose exec -T backend npx prisma migrate deploy
```

סקריפטים: `seed:keywords`, `cleanup:duplicates` ב-`backend/package.json`.

---

## קישורים

- [INSTALLATION.md](./INSTALLATION.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
