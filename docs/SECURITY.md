# אבטחה

## אימות

### JWT

- חתימה עם `JWT_SECRET`; ב-`JwtModule` מוגדר `expiresIn: '15m'` ל-access token.
- Refresh ו-cookies — ראו `auth.service` / controller לשמות ומדיניות cookie.

### רשימת חסימה

- `TokenBlacklistService` (Redis) — ביטול access tokens לפני פקיעה.

### 2FA (TOTP)

- `TwoFactorService` — setup, enable, disable.
- סוד וקודי שחזור נשמרים מוצפנים (שדות Iv/Tag בטבלת `User`).

### נעילת חשבון

- `AccountLockoutService` — ניסיונות כושלים, Redis.

## הצפנת credentials בנק

- `EncryptionModule` — AES-256-GCM.
- `ENCRYPTION_MASTER_KEY` חייב להיות מוגדר נכון בפרודקשן.

## Helmet (Fastify)

- `main.ts`: `@fastify/helmet` עם `contentSecurityPolicy: false` (נפוץ ל-SPA; ניתן להקשיח CSP לפי צורך).

## הגבלת קצב

### Nest (Throttler)

- ברירת מחדל: 100 בקשות ל-60 שניות (`app.module.ts`).
- `ThrottlerGuard` גלובלי.
- `HealthController` ו-`AuthController`: `@SkipThrottle()` — throttling של Nest לא חל שם.

### Nginx

- `limit_req` ל-`/api/` ול-login (ראו `nginx/nginx.conf`).

## תפעול

1. לא לשמור `.env` ב-Git.
2. לגבות `data/postgres` או snapshot ל-LXC.
3. להפעיל 2FA כשמתאים.
4. לעדכן תלויות (`npm audit`) בתדירות סבירה.

[CONFIGURATION.md](./CONFIGURATION.md) · [API.md](./API.md)
