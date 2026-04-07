# מסד נתונים (PostgreSQL + Prisma)

סכמת Prisma: `backend/prisma/schema.prisma`.

## תרשים ERD (Mermaid)

```mermaid
erDiagram
  User ||--o{ Account : has
  User ||--o{ Category : has
  User ||--o{ Budget : has
  User ||--o{ ScraperConfig : has
  User ||--o| UserSettings : has

  Account ||--o{ Transaction : contains

  Category ||--o{ Transaction : classifies
  Category ||--o{ BudgetCategory : budgeted_in
  Category ||--o{ Category : parent

  Budget ||--o{ BudgetCategory : lines

  User {
    uuid id PK
    string email UK
    string passwordHash
    string role
    boolean twoFactorEnabled
  }

  UserSettings {
    uuid userId PK_FK
    int salaryStartDay
    int salaryEndDay
    boolean includePendingInBudget
    boolean includePendingInDashboard
    boolean excludeCreditCardChargesFromBudget
  }

  Account {
    uuid id PK
    uuid userId FK
    string institutionId
    AccountType accountType
    string nickname
    string description
  }

  Transaction {
    uuid id PK
    uuid accountId FK
    uuid categoryId FK
    TransactionStatus status
    datetime date
    datetime effectiveDate
    decimal amount
    string note
    boolean isExcludedFromCashFlow
    string pendingMatchHash
    string scraperHash UK
  }

  Category {
    uuid id PK
    uuid userId FK
    string nameHe
    boolean isIncome
    boolean isFixed
    boolean isTracked
    json keywords
  }

  Budget {
    uuid id PK
    uuid userId FK
    int month
    int year
  }

  ScraperConfig {
    uuid id PK
    uuid userId FK
    string companyId
    text encryptedCredentials
  }
```

## טבלאות ותפקיד

| טבלה | תיאור |
|------|--------|
| **User** | משתמש, סיסמה מגובבת, 2FA, קודי שחזור מוצפנים |
| **UserSettings** | העדפות UI/התראות, טווח משכורת, pending בדשבורד/תקציב, כיבוי זיהוי חיובי אשראי |
| **ScraperConfig** | קישור למוסד + אישורים מוצפנים (IV + auth tag), סטטוס סנכרון |
| **Account** | חשבון בנק/אשראי לפי מוסד ומספר חשבון, כינוי, תיאור |
| **Transaction** | עסקה: סכום, תאריכים, קטגוריה, סטטוס pending/completed, hash לדדופ |
| **Category** | קטגוריה (מערכת/משתמש), היררכיה אופציונלית, מילות מפתח |
| **Budget** | תקציב לחודש/שנה |
| **BudgetCategory** | סכום תקציב לקטגוריה בתוך תקציב |

## שדות חשובים

### Transaction

| שדה | משמעות |
|-----|--------|
| `status` | `PENDING` — בתהליך קליטה; `COMPLETED` — סופי |
| `effectiveDate` | תאריך לחישוב דשבורד/תקציב להכנסות (משכורת בסוף חודש → חודש הבא) |
| `note` | הערה קצרה מהממשק (נפרד מ־`notes`/`memo`) |
| `isExcludedFromCashFlow` | כאשר `true` — לא נספר בתקציב/תזרים (למשל חיוב אשראי אגרגטיבי מהבנק) |
| `pendingMatchHash` | מפתח התאמה לזיהוי אותה עסקה כשעוברת מ־pending ל־completed |
| `scraperHash` | Hash ייחודי גלובלי לעסקה (מניעת כפילויות בסנכרון) |

### Account

| שדה | משמעות |
|-----|--------|
| `nickname` | שם תצוגה קצר |
| `description` | תיאור חופשי |

### Category

| שדה | משמעות |
|-----|--------|
| `isIncome` | קטגוריית הכנסה (משפיע על חישוב `effectiveDate` למשכורת) |
| `isFixed` | סימון תכונת "קבוע" (שימוש לוגי/UI לפי צורך) |
| `isTracked` | מעקב בתקציב/דוחות לפי הגדרת המוצר |
| `keywords` | JSON — מערך מחרוזות לסיווג אוטומטי |

### UserSettings

| שדה | משמעות |
|-----|--------|
| `salaryStartDay` | יום ראשון בטווח משכורת (ברירת מחדל 25) |
| `salaryEndDay` | יום אחרון בטווח (ברירת מחדל 31) |
| `excludeCreditCardChargesFromBudget` | כש־`true` — הסקרייפר מסמן אוטומטית חיובי אשראי מחשבון בנק כלא בתקציב |

## Enums

- `AccountType`: `BANK` | `CREDIT_CARD`
- `TransactionType`: `NORMAL` | `INSTALLMENTS` | `CREDIT` | `REFUND` | `CASH` | `TRANSFER` | `FEE` | `INTEREST`
- `TransactionStatus`: `PENDING` | `COMPLETED`

## אינדקסים וייחודיות (תמצית)

- `Transaction.scraperHash` — ייחודי גלובלי
- `@@unique([accountId, date, amount, description])` — מניעת שורה זהה באותו חשבון
- אינדקס על `[accountId, status]`, `[pendingMatchHash]`, `[categoryId]`

קישורים: [ARCHITECTURE.md](./ARCHITECTURE.md) · [PENDING_TRANSACTIONS.md](./PENDING_TRANSACTIONS.md) · [SALARY_SETTINGS.md](./SALARY_SETTINGS.md)
