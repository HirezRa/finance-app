# תאריך אפקטיבי למשכורת (`effectiveDate`)

## מטרה

עסקאות הכנסה שמסומנות >קטגוריית משכורת< יכולות לקבל **`effectiveDate`** — תאריך שמייצג לאיזה **חודש תקציב** העסקה נספרת (למשל משכורת בסוף מאי שנספרת ביוני).

## לוגיקה (קוד)

- קובץ: `backend/src/common/utils/salary-effective-date.ts` — `computeSalaryEffectiveDateForBankDate`.
- טווח ימים בחודש הלוח הישראלי (`Asia/Jerusalem`) מגיע מ־`UserSettings.salaryStartDay` / `salaryEndDay` (ברירת מחדל 25–31).
- **כלל (2026-05):** אם **יום בחודש הישראלי < 15**, לא מחשבים `effectiveDate` (מחזירים `null`) גם אם הטווח כולל את היום הזה (למשל טעות 1–31). כך הפקדות ב־**1–14 בחודש** (כולל משכורת ב־1 במאי) נשארות מיוחסות לחודש הבנק בפועל, ולא “נופלות” מסיכום מאי בדשבורד כשהן קיבלו `effectiveDate` לחודש הבא.
- **ריצה (דשבורד / תקציב / ייצוא):** `cashFlowAnchorDateForTxn` — להכנסה עם יום בנק בישראל **1–14** משתמשים ב־**`date`** כעוגן גם אם ב־DB נשאר `effectiveDate` ישן (לפני תיקון או לפני שמירה מחדש של טווח המשכורת), כדי שלא תיעלם משכורת מ־1 במאי ממחזור מאי.

## סנכרון / שינוי הגדרות

אחרי שינוי טווח משכורת בהגדרות, השרת מריץ עדכון מחדש ל־`effectiveDate` על עסקאות הכנסה (ראו `SettingsService`).

### סנכרון בנקאי (`ScraperService`)

תאריך עסקה מהבנק נשמר כ־**תחילת יום אזרחי בישראל** ב־UTC (`startOfIsraelCivilDayInUtc`), וממנו נגזרים גם `scraperHash` ודה־דופ רך — לא מחרוזת `toISOString().slice(0, 10)` (יום UTC), כדי שמשכורות (למשל 1 במאי) לא ייסננו או ייוחסו ליום שגוי מול הדשבורד והמחזור.

## ריפוי אוטומטי בשרת (גרסה 2.0.52+)

- שירות: `SalaryEffectiveDateHealService` — **cron יומי** (`30 3 * * *`, כלומר 03:30 UTC) סורק עסקאות הכנסה עם `effectiveDate IS NOT NULL` ומאפס את השדה כש־**יום בחודש הישראלי לפי `date` < 15** (תואם לכלל המשכורת).
- **כיבוי:** `DISABLE_SALARY_EFFECTIVE_DATE_HEAL=true` (או `1` / `yes`).
- **גבול סריקה לריצה אחת** (מונע ריצה ארוכה ב־DB ענקי): `SALARY_EFFECTIVE_DATE_HEAL_MAX_SCAN` — מספר מקסימלי של שורות עם `effectiveDate` לא־ריק שנבדקות בריצה (ברירת מחדל **12000**; המשך בריצה המחרתית אם יש עוד).

## תיקון נתונים קיימים (אופציונלי)

מומלץ **גיבוי DB** לפני `--execute` או לפני ה־`UPDATE`.

אם היו רשומות עם `effectiveDate` בחודש הבא למרות שהפקדה הייתה ב־1–14 בחודש הישראלי, אפשר:

1. לשמור שוב את טווח המשכורת בהגדרות (כדי להפעיל את הלוגיקה המעודכנת), או  
2. להריץ את סקריפט Prisma (מומלץ — אותה לוגיקת `getIsraelYmd` כמו בקוד):

   מתוך `backend/`:

   ```bash
   # תצוגה בלבד (ברירת מחדל)
   npx ts-node prisma/clear-early-month-income-effective-date.ts

   # מאי 2026 בלוח ישראלי, ימים 1–14, כל המשתמשים — ביצוע
   BANK_YEAR=2026 BANK_MONTH=5 npx ts-node prisma/clear-early-month-income-effective-date.ts --execute

   # משתמש בודד
   BANK_YEAR=2026 BANK_MONTH=5 USER_ID='<uuid>' npx ts-node prisma/clear-early-month-income-effective-date.ts --execute
   ```

   ב־Windows (PowerShell) אפשר: `$env:BANK_YEAR=2026; $env:BANK_MONTH=5; npx ts-node prisma/clear-early-month-income-effective-date.ts --execute`

3. **SQL ישיר (PostgreSQL)** — מקביל ללוגיקה למעלה (הכנסה, תאריך בנק במאי 2026 ב־`Asia/Jerusalem`, יום 1–14, `effectiveDate` לא ריק):

   ```sql
   -- תצוגה מקדימה
   SELECT t.id,
          t.date,
          t."effectiveDate",
          (t.date AT TIME ZONE 'Asia/Jerusalem')::date AS bank_date_il
   FROM "Transaction" t
   INNER JOIN "Category" c ON c.id = t."categoryId"
   WHERE t."effectiveDate" IS NOT NULL
     AND c."isIncome" = true
     AND EXTRACT(YEAR  FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int = 2026
     AND EXTRACT(MONTH FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int = 5
     AND EXTRACT(DAY   FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int < 15;

   -- עדכון (הרץ רק אחרי בדיקת ה-SELECT)
   UPDATE "Transaction" t
   SET "effectiveDate" = NULL
   FROM "Category" c
   WHERE c.id = t."categoryId"
     AND t."effectiveDate" IS NOT NULL
     AND c."isIncome" = true
     AND EXTRACT(YEAR  FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int = 2026
     AND EXTRACT(MONTH FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int = 5
     AND EXTRACT(DAY   FROM (t.date AT TIME ZONE 'Asia/Jerusalem'))::int < 15;
   ```

   להגבלה למשתמש אחד הוסף `INNER JOIN "Account" a ON a.id = t."accountId" AND a."userId" = '<uuid>'` גם ב־SELECT וגם ב־UPDATE.

## סינון לפי `startDate` / `endDate` (API עסקאות)

מחרוזות **`YYYY-MM-DD`** בלבד (ללא שעה) מפורשות כ־**ימים אזרחיים בישראל** — גבולות UTC מחושבים ב־`startOfIsraelCivilDayInUtc` / `endOfIsraelCivilDayInUtc` (`israel-calendar.ts`) כדי שלא ייעלמו עסקאות בגלל `T00:00:00Z` מול אזור זמן ישראל.

## ייצוא Excel

ב־`transactions-export.service.ts` מסננים עסקאות לפי מחזור כך שיכנסו גם אם **`date`** וגם אם **`effectiveDate`** נופלים בחודש (ראו גרסה 2.0.45 ב־`CHANGELOG.md`).
