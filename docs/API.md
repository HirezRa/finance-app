# תיעוד API

**קידומת גלובלית:** `api/v1` (מוגדרת ב-`main.ts`).

**דוגמת Base URL:** `http://<IP-או-דומיין>/api/v1`  
(בפריסה סטנדרטית כל התעבורה עוברת דרך nginx על פורט 80.)

רוב הנתיבים דורשים כותרת:

```http
Authorization: Bearer <access_token>
```

---

## בריאות (ללא אימות)

### `GET /health`

מחזיר סטטוס שרת (למשל `{ "status": "ok", "ts": "..." }`).

דוגמה:

```bash
curl -sS --max-time 10 "http://<host>/api/v1/health"
```

---

## אימות (`/auth`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| POST | `/auth/register` | הרשמה (`email`, `password` — מינימום 8 תווים) |
| POST | `/auth/login` | התחברות |
| GET | `/auth/2fa/status` | סטטוס 2FA (דורש JWT) |
| GET | `/auth/2fa/setup` | התחלת הגדרת 2FA |
| POST | `/auth/2fa/enable` | הפעלה |
| POST | `/auth/2fa/disable` | כיבוי |
| GET | `/auth/2fa/setup` | (חוזר בהתאם ליישום) |

> ה-controller של `auth` מסומן `@SkipThrottle()` — מגבלות קצב נפרות ב-nginx עבור `/api/v1/auth/login`.

---

## משתמש

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/users/me` | פרופיל בסיסי (דורש JWT) |

---

## Dashboard (`/dashboard`)

Query אופציונלי: `month`, `year` (מספרים).

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/dashboard/summary` | סיכום תזרים חודשי |
| GET | `/dashboard/weekly` | פילוח שבועי (הוצאות) |
| GET | `/dashboard/categories` | פילוח לפי קטגוריה |
| GET | `/dashboard/recent` | עסקאות אחרונות |
| GET | `/dashboard/accounts` | סקירת חשבונות |

---

## עסקאות (`/transactions`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/transactions` | רשימה (פרמטרים לפי ה-controller/DTO) |
| POST | `/transactions` | יצירה ידנית |
| POST | `/transactions/recategorize-all` | סיווג מחדש לפי מילות מפתח |
| PATCH | `/transactions/bulk/category` | עדכון קטגוריה מרוכז |
| GET | `/transactions/:id` | פרטים |
| PATCH | `/transactions/:id` | עדכון |
| DELETE | `/transactions/:id` | מחיקה |

---

## חשבונות (`/accounts`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/accounts` | רשימה |
| GET | `/accounts/:id/summary` | סיכום |
| GET | `/accounts/:id` | פרטים |
| PATCH | `/accounts/:id` | עדכון (כינוי, פעיל וכו') |
| DELETE | `/accounts/:id` | מחיקה |

---

## קטגוריות (`/categories`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/categories` | כל הקטגוריות (מערכת + משתמש) |
| GET | `/categories/income` | הכנסות |
| GET | `/categories/expenses` | הוצאות |
| GET | `/categories/:id` | פרטים |
| POST | `/categories` | יצירה |
| PATCH | `/categories/:id` | עדכון (מערכת: בעיקר `keywords`) |
| DELETE | `/categories/:id` | מחיקה (לא מערכת) |

---

## תקציב (`/budgets`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/budgets/history` | היסטוריה (`?months=6`) |
| GET | `/budgets` | תקציב לחודש (`?month=&year=`) |
| POST | `/budgets` | יצירה |
| PUT | `/budgets/:month/:year` | עדכון |
| DELETE | `/budgets/:month/:year` | מחיקה |
| POST | `/budgets/:month/:year/copy-previous` | העתקה מהחודש הקודם |

---

## סנכרון (`/scraper`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/scraper/institutions` | מוסדות נתמכים |
| GET | `/scraper/configs` | הגדרות משתמש |
| POST | `/scraper/configs` | הוספת הגדרה |
| DELETE | `/scraper/configs/:id` | מחיקה |
| POST | `/scraper/sync/:configId` | סנכרון יחיד |
| POST | `/scraper/sync-all` | סנכרון הכל |
| GET | `/scraper/version` | גרסת ספריית הסקרייפר |
| GET | `/scraper/check-updates` | בדיקת עדכונים |

---

## הגדרות (`/settings`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/settings` | הגדרות משתמש (כולל שדות חדשים כמו דגלי תקציב) |
| PATCH | `/settings` | עדכון |
| GET | `/settings/profile` | פרופיל |
| PATCH | `/settings/profile` | עדכון פרופיל |
| GET/PATCH | `/settings/integrations/ollama` | OLLAMA |
| POST | `/settings/integrations/ollama/test` | בדיקה |
| GET/PATCH | `/settings/integrations/n8n` | n8n |
| POST | `/settings/integrations/n8n/test` | בדיקת webhook |

---

## התראות (`/alerts`)

| שיטה | נתיב | תיאור |
|--------|------|--------|
| GET | `/alerts` | התראות מחושבות/מוצגות |

---

## קישורים

- [CONFIGURATION.md](./CONFIGURATION.md)
- [SECURITY.md](./SECURITY.md)
