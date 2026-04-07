# פרומפט מלא ל-Cursor: פיתוח אפליקציית ניהול פיננסי אישי

> **הערה:** שם האפליקציה, לוגו וברנדינג ניתנים להתאמה אישית. 
> בקוד נעשה שימוש בשמות גנריים שניתן לשנות בקלות.

---

## מדריך התקנה מהיר (Quick Start)

### דרישות מקדימות
- Docker & Docker Compose
- 2GB RAM מינימום (4GB מומלץ)
- 10GB דיסק פנוי

### התקנה ב-3 שלבים

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/finance-app.git
cd finance-app

# 2. Create and configure .env
cp .env.example .env

# Generate secrets (Linux/Mac)
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)" >> .env
echo "ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32)" >> .env
echo "DB_PASSWORD=$(openssl rand -hex 16)" >> .env

# 3. Start the application
docker-compose up -d
```

### גישה לאפליקציה
- **Web UI:** http://localhost:3000
- **API:** http://localhost:3000/api
- **Bull Board (queues):** http://localhost:3001

### הגדרות ראשוניות (דרך הממשק)
1. הירשם / התחבר
2. הגדרות → אינטגרציות:
   - **OLLAMA** (אופציונלי): הזן כתובת שרת OLLAMA ובדוק חיבור
   - **n8n** (אופציונלי): הזן webhook URL להתראות
3. חשבונות → הוסף חשבון בנק/כרטיס אשראי

### פריסה עם SSL (Production)

```bash
# Option 1: Behind Nginx Proxy Manager / Traefik
# Just point your reverse proxy to port 3000

# Option 2: Built-in nginx with Let's Encrypt
# Edit nginx/default.conf with your domain
# Add SSL certificates to nginx/ssl/
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
```

### גיבויים

```bash
# Backup database
docker exec finance-db pg_dump -U finance finance_app > backup_$(date +%Y%m%d).sql

# Restore database
docker exec -i finance-db psql -U finance finance_app < backup_20260301.sql
```

---

## הקשר כללי

אני רוצה לפתח אפליקציית ניהול פיננסי אישי (Self-Hosted) בעברית. האפליקציה צריכה להיות:
- **גנרית לחלוטין** — ניתנת להתקנה על כל שרת Linux עם Docker
- **מתממשקת לבנקים ישראליים** דרך ספריית `israeli-bank-scrapers`
- **תומכת באינטגרציית AI אופציונלית** עם OLLAMA (ניתן להגדרה בממשק)
- **תומכת באינטגרציית n8n אופציונלית** לאוטומציות (ניתן להגדרה בממשק)
- **תומכת במספר משתמשים** עם מערכת הרשאות

**עקרון מפתח:** כל השירותים החיצוניים (OLLAMA, n8n) הם אופציונליים וניתנים להגדרה דרך ממשק המשתמש — האפליקציה עובדת באופן מלא גם בלעדיהם.

---

## דרישות טכניות מחייבות

### סטאק טכנולוגי

```
Frontend:
- React 19 + TypeScript
- Vite כ-build tool
- shadcn/ui (מבוסס Radix UI) לקומפוננטות
- Tailwind CSS v4
- Recharts לגרפים
- React Hook Form + Zod לטפסים
- TanStack Query (React Query) לניהול state מרוחק
- TanStack Table לטבלאות
- Workbox ל-PWA/Service Worker
- i18next לתמיכה בעברית RTL

Backend:
- NestJS עם Fastify adapter
- TypeScript
- Prisma ORM
- PostgreSQL 16
- Redis 7 (cache + BullMQ backend)
- BullMQ לתורים ותזמון
- `israeli-bank-scrapers` מ־fork מאובטח: `github:HirezRa/israeli-bank-scrapers` (מקור: npm `eshaham/israeli-bank-scrapers` הוחלף)
- Tesseract.js לOCR
- @nestjs/jwt + @nestjs/passport לאימות

Infrastructure:
- Docker Compose
- Node.js >= 22.12.0
- nginx כ-reverse proxy
```

### חשוב מאוד: israeli-bank-scrapers

**תמיד להשתמש בגרסה האחרונה של הספרייה!**

הספרייה `israeli-bank-scrapers` מתעדכנת תדיר כי בנקים משנים את האתרים שלהם. שימוש בגרסה ישנה יגרום לכשלונות סנכרון.

```json
// backend/package.json
{
  "dependencies": {
    "israeli-bank-scrapers": "github:HirezRa/israeli-bank-scrapers"
  }
}
```

**מנגנון עדכון אוטומטי:**

```typescript
// backend/src/modules/scraper/scraper-update.service.ts

/**
 * ScraperUpdateService - בדיקה ועדכון אוטומטי של israeli-bank-scrapers
 * 
 * checkForUpdates(): Promise<UpdateCheckResult>
 *   - בדיקה יומית (cron) אם יש גרסה חדשה ב-npm
 *   - השוואת הגרסה המותקנת מול הגרסה האחרונה
 *   - שליחת webhook/התראה אם יש עדכון זמין
 * 
 * getCurrentVersion(): string
 *   - החזרת הגרסה המותקנת כרגע
 * 
 * getLatestVersion(): Promise<string>
 *   - שליפת הגרסה האחרונה מ-npm registry
 *   - GitHub releases: https://api.github.com/repos/HirezRa/israeli-bank-scrapers/releases/latest
 */

interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  releaseDate?: string;
}
```

**Dockerfile עם עדכון אוטומטי:**

```dockerfile
# backend/Dockerfile

FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Dependency pinned to secure fork in package.json (github:HirezRa/israeli-bank-scrapers); builder image needs git
RUN apk add --no-cache git
RUN npm install

# Install Chromium for Puppeteer
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY . .
RUN npm run build

CMD ["npm", "run", "start:prod"]
```

**סקריפט בדיקת עדכונים (נכלל ב-package.json):**

```json
// backend/package.json
{
  "scripts": {
    "scraper:check-update": "npm outdated israeli-bank-scrapers || true",
    "scraper:update": "npm install github:HirezRa/israeli-bank-scrapers && npm run build",
    "prestart:prod": "npm run scraper:check-update"
  }
}
```

**התראה על גרסה חדשה בממשק:**

```typescript
// GET /api/v1/admin/scraper-status
// מחזיר מידע על גרסת הסקרייפר ואם יש עדכון זמין

interface ScraperStatusResponse {
  installedVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  lastChecked: string;
  supportedInstitutions: string[];  // רשימת בנקים נתמכים בגרסה הנוכחית
}
```

**הוראות עדכון ידני (אם צריך):**

```bash
# בתוך הcontainer
docker exec -it finance-backend sh
npm install github:HirezRa/israeli-bank-scrapers
npm run build
exit

# או rebuild מלא
docker-compose build --no-cache backend
docker-compose up -d backend
```

### חיבור לשירותים חיצוניים (כולם אופציונליים וניתנים להגדרה בממשק)

```yaml
OLLAMA Server (אופציונלי):
  enabled: false  # ברירת מחדל: כבוי
  url: ""         # המשתמש מגדיר בממשק, למשל: http://localhost:11434
  model: mistral  # ניתן לבחירה מרשימה
  purpose: קטגוריזציה חכמה + תחזיות + ניתוח
  fallback: כללי קטגוריזציה סטטיים (עובד מצוין גם בלי AI)

n8n Server (אופציונלי):
  enabled: false  # ברירת מחדל: כבוי
  webhook_url: "" # המשתמש מגדיר בממשק, למשל: http://localhost:5678/webhook/
  purpose: אוטומציות והתראות
  fallback: התראות פנימיות באפליקציה + אימייל

PostgreSQL (נכלל ב-Docker Compose):
  port: 5432
  database: finance_app

Redis (נכלל ב-Docker Compose):
  port: 6379
  purpose: BullMQ + caching + session blacklist
```

**הערה חשובה:** האפליקציה עובדת באופן מלא גם ללא OLLAMA ו-n8n. הפיצ'רים שמסתמכים עליהם פשוט משתמשים ב-fallback מובנה.

---

## מבנה הפרויקט

```
finance-app/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── default.conf
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── common/
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   └── roles.guard.ts
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts
│       │   │   └── roles.decorator.ts
│       │   ├── interceptors/
│       │   │   └── user-scope.interceptor.ts
│       │   ├── filters/
│       │   │   └── http-exception.filter.ts
│       │   └── utils/
│       │       └── encryption.util.ts
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── auth.module.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── strategies/
│       │   │   │   ├── jwt.strategy.ts
│       │   │   │   └── jwt-refresh.strategy.ts
│       │   │   └── dto/
│       │   │       ├── login.dto.ts
│       │   │       ├── register.dto.ts
│       │   │       └── tokens.dto.ts
│       │   ├── users/
│       │   │   ├── users.module.ts
│       │   │   ├── users.controller.ts
│       │   │   ├── users.service.ts
│       │   │   └── dto/
│       │   ├── accounts/
│       │   │   ├── accounts.module.ts
│       │   │   ├── accounts.controller.ts
│       │   │   ├── accounts.service.ts
│       │   │   └── dto/
│       │   ├── transactions/
│       │   │   ├── transactions.module.ts
│       │   │   ├── transactions.controller.ts
│       │   │   ├── transactions.service.ts
│       │   │   └── dto/
│       │   ├── categories/
│       │   │   ├── categories.module.ts
│       │   │   ├── categories.controller.ts
│       │   │   ├── categories.service.ts
│       │   │   └── dto/
│       │   ├── budgets/
│       │   │   ├── budgets.module.ts
│       │   │   ├── budgets.controller.ts
│       │   │   ├── budgets.service.ts
│       │   │   └── dto/
│       │   ├── scraper/
│       │   │   ├── scraper.module.ts
│       │   │   ├── scraper.service.ts
│       │   │   ├── scraper.processor.ts  # BullMQ worker
│       │   │   ├── scraper-config.service.ts
│       │   │   └── scraper-update.service.ts  # בדיקה ועדכון גרסה
│       │   ├── ollama/
│       │   │   ├── ollama.module.ts
│       │   │   ├── ollama.service.ts
│       │   │   └── prompts/
│       │   │       ├── categorize.prompt.ts
│       │   │       └── forecast.prompt.ts
│       │   ├── ocr/
│       │   │   ├── ocr.module.ts
│       │   │   ├── ocr.controller.ts
│       │   │   └── ocr.service.ts
│       │   ├── webhooks/
│       │   │   ├── webhooks.module.ts
│       │   │   ├── webhooks.service.ts
│       │   │   └── webhook-events.enum.ts
│       │   ├── dashboard/
│       │   │   ├── dashboard.module.ts
│       │   │   ├── dashboard.controller.ts
│       │   │   └── dashboard.service.ts
│       │   └── reports/
│       │       ├── reports.module.ts
│       │       ├── reports.controller.ts
│       │       └── reports.service.ts
│       └── config/
│           ├── configuration.ts
│           └── validation.schema.ts
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   └── icons/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       ├── components/
│       │   ├── ui/           # shadcn components
│       │   ├── layout/
│       │   │   ├── Header.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   └── MainLayout.tsx
│       │   ├── dashboard/
│       │   │   ├── CashFlowCard.tsx
│       │   │   ├── RemainingBudget.tsx
│       │   │   ├── WeeklyBreakdown.tsx
│       │   │   ├── CategoryChart.tsx
│       │   │   └── TrendChart.tsx
│       │   ├── transactions/
│       │   │   ├── TransactionList.tsx
│       │   │   ├── TransactionRow.tsx
│       │   │   ├── TransactionFilters.tsx
│       │   │   └── CategoryBadge.tsx
│       │   ├── accounts/
│       │   │   ├── AccountsList.tsx
│       │   │   ├── AddAccountModal.tsx
│       │   │   └── AccountCard.tsx
│       │   ├── budgets/
│       │   │   ├── BudgetOverview.tsx
│       │   │   ├── BudgetCategoryRow.tsx
│       │   │   └── SetBudgetModal.tsx
│       │   ├── ocr/
│       │   │   ├── ReceiptScanner.tsx
│       │   │   └── ReceiptPreview.tsx
│       │   ├── settings/
│       │   │   ├── ProfileSettings.tsx
│       │   │   ├── NotificationSettings.tsx
│       │   │   ├── IntegrationsSettings.tsx  # Main integrations page
│       │   │   ├── OllamaSettings.tsx        # AI connection settings
│       │   │   ├── N8nSettings.tsx           # n8n webhook settings
│       │   │   ├── EmailSettings.tsx         # SMTP settings
│       │   │   ├── WebhookSettings.tsx
│       │   │   ├── HouseholdSettings.tsx
│       │   │   └── AppearanceSettings.tsx    # Theme, language
│       │   └── common/
│       │       ├── LoadingSpinner.tsx
│       │       ├── ErrorBoundary.tsx
│       │       └── ConfirmDialog.tsx
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── TransactionsPage.tsx
│       │   ├── AccountsPage.tsx
│       │   ├── BudgetsPage.tsx
│       │   ├── ReportsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── LoginPage.tsx
│       │   └── RegisterPage.tsx
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useDashboard.ts
│       │   ├── useTransactions.ts
│       │   ├── useAccounts.ts
│       │   ├── useBudgets.ts
│       │   └── useOCR.ts
│       ├── services/
│       │   ├── api.ts           # axios instance
│       │   ├── auth.service.ts
│       │   ├── transactions.service.ts
│       │   ├── accounts.service.ts
│       │   ├── budgets.service.ts
│       │   └── ocr.service.ts
│       ├── store/
│       │   └── auth.store.ts    # Zustand
│       ├── lib/
│       │   ├── utils.ts
│       │   └── constants.ts
│       ├── i18n/
│       │   ├── i18n.ts
│       │   └── locales/
│       │       └── he.json
│       └── styles/
│           └── globals.css
│
└── docs/
    ├── API.md
    ├── DEPLOYMENT.md
    └── ARCHITECTURE.md
```

---

## סכמת בסיס נתונים (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  USER
  VIEWER
}

enum TransactionStatus {
  COMPLETED
  PENDING
}

enum TransactionType {
  NORMAL
  INSTALLMENTS
}

enum AccountType {
  BANK
  CREDIT_CARD
}

model User {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String
  name              String
  role              UserRole  @default(USER)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // Household support - multiple users can share data
  householdId       String?
  household         Household? @relation(fields: [householdId], references: [id])
  
  accounts          Account[]
  categories        Category[]
  budgets           Budget[]
  scraperConfigs    ScraperConfig[]
  manualTransactions Transaction[] @relation("ManualTransactions")
  settings          UserSettings?
  
  @@index([householdId])
  @@index([email])
}

model Household {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  
  members   User[]
  
  @@map("households")
}

model Account {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  institutionId   String      // e.g., "hapoalim", "leumi", "max"
  institutionName String      // Display name
  accountNumber   String
  accountType     AccountType
  nickname        String?
  balance         Decimal?    @db.Decimal(15, 2)
  currency        String      @default("ILS")
  
  isActive        Boolean     @default(true)
  lastSyncAt      DateTime?
  lastSyncStatus  String?     // "success", "error", error message
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  transactions    Transaction[]
  
  @@unique([userId, institutionId, accountNumber])
  @@index([userId])
  @@index([institutionId])
}

model Transaction {
  id                String            @id @default(uuid())
  accountId         String
  account           Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)
  
  categoryId        String?
  category          Category?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  
  // Core fields
  type              TransactionType   @default(NORMAL)
  status            TransactionStatus @default(COMPLETED)
  date              DateTime          @db.Date
  processedDate     DateTime?         @db.Date  // Charge date for credit cards
  
  amount            Decimal           @db.Decimal(15, 2)  // Negative = expense
  originalAmount    Decimal?          @db.Decimal(15, 2)
  originalCurrency  String            @default("ILS")
  
  description       String
  memo              String?
  
  // Installments
  installmentNumber Int?
  installmentTotal  Int?
  
  // Metadata
  scraperIdentifier String?           // Original identifier from scraper
  scraperHash       String?           @unique  // For deduplication
  rawData           Json?             // Original scraper response
  
  // Manual transaction support
  isManual          Boolean           @default(false)
  createdByUserId   String?
  createdByUser     User?             @relation("ManualTransactions", fields: [createdByUserId], references: [id])
  
  // User customizations
  notes             String?
  isExcludedFromCashFlow Boolean      @default(false)  // For transfers between accounts
  
  // AI categorization
  aiCategoryConfidence Float?         // 0-1 confidence score
  aiCategorizedAt   DateTime?
  
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  
  @@index([accountId])
  @@index([categoryId])
  @@index([date])
  @@index([processedDate])
  @@index([scraperHash])
  @@index([isExcludedFromCashFlow])
}

model Category {
  id          String    @id @default(uuid())
  userId      String?   // null = system category
  user        User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  name        String
  nameHe      String    // Hebrew name
  icon        String?   // Emoji or icon name
  color       String?   // Hex color
  
  parentId    String?
  parent      Category? @relation("SubCategories", fields: [parentId], references: [id])
  children    Category[] @relation("SubCategories")
  
  isSystem    Boolean   @default(false)
  isIncome    Boolean   @default(false)  // Income vs expense
  isFixed     Boolean   @default(false)  // Fixed expense (rent, subscriptions)
  isTracked   Boolean   @default(true)   // Show in tracked categories
  
  // For AI learning - keywords that match this category
  keywords    String[]
  
  sortOrder   Int       @default(0)
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  transactions    Transaction[]
  budgetCategories BudgetCategory[]
  
  @@unique([userId, name])
  @@index([userId])
  @@index([isSystem])
}

model Budget {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  month     Int      // 1-12
  year      Int
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  categories BudgetCategory[]
  
  @@unique([userId, month, year])
  @@index([userId])
}

model BudgetCategory {
  id          String   @id @default(uuid())
  budgetId    String
  budget      Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  amount      Decimal  @db.Decimal(15, 2)
  
  @@unique([budgetId, categoryId])
  @@index([budgetId])
}

model ScraperConfig {
  id                    String   @id @default(uuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  companyId             String   // e.g., "hapoalim", "leumi", "max"
  companyDisplayName    String
  
  // Encrypted credentials - AES-256-GCM
  encryptedCredentials  String   @db.Text
  credentialsIv         String
  credentialsAuthTag    String
  
  // 2FA long-term token (optional)
  encryptedToken        String?  @db.Text
  tokenIv               String?
  tokenAuthTag          String?
  
  isActive              Boolean  @default(true)
  lastSyncAt            DateTime?
  lastSyncStatus        String?
  lastError             String?
  
  // Sync settings
  syncEnabled           Boolean  @default(true)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@unique([userId, companyId])
  @@index([userId])
  @@index([isActive])
}

model WebhookConfig {
  id          String   @id @default(uuid())
  userId      String
  
  name        String
  url         String
  secret      String   // For HMAC signing
  
  events      String[] // Array of event types to send
  isActive    Boolean  @default(true)
  
  lastTriggeredAt DateTime?
  lastStatus      String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([userId])
  @@index([isActive])
}

model SystemSettings {
  id          String   @id @default(uuid())
  
  // OLLAMA Configuration - Global
  ollamaEnabled     Boolean  @default(false)
  ollamaUrl         String?  // e.g., "http://localhost:11434"
  ollamaModel       String   @default("mistral")
  ollamaTimeout     Int      @default(30000)  // milliseconds
  
  // n8n Configuration - Global
  n8nEnabled        Boolean  @default(false)
  n8nWebhookUrl     String?  // e.g., "http://localhost:5678/webhook/"
  n8nWebhookSecret  String?
  
  // Email Configuration - Global fallback
  smtpEnabled       Boolean  @default(false)
  smtpHost          String?
  smtpPort          Int      @default(587)
  smtpUser          String?
  smtpPass          String?  // encrypted
  smtpFrom          String   @default("noreply@example.com")
  
  // Categorization settings
  useFallbackRules  Boolean  @default(true)  // Use static rules when OLLAMA unavailable
  aiConfidenceThreshold Float @default(0.5)  // Min confidence to auto-apply category
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UserSettings {
  id          String   @id @default(uuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // OLLAMA Override - User can override global settings
  ollamaEnabled     Boolean?  // null = use global setting
  ollamaUrl         String?   // null = use global setting
  ollamaModel       String?   // null = use global setting
  
  // n8n Override - User can have their own webhook
  n8nEnabled        Boolean?
  n8nWebhookUrl     String?
  n8nWebhookSecret  String?
  
  // Notification preferences
  emailNotifications    Boolean @default(true)
  pushNotifications     Boolean @default(true)
  weeklyDigest          Boolean @default(true)
  
  // Display preferences
  defaultCurrency       String  @default("ILS")
  dateFormat            String  @default("DD/MM/YYYY")
  largeExpenseThreshold Decimal @default(500) @db.Decimal(15, 2)
  
  // UI preferences
  theme                 String  @default("system")  // "light", "dark", "system"
  language              String  @default("he")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([userId])
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  entity    String
  entityId  String?
  oldValue  Json?
  newValue  Json?
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

---

## קטגוריות מערכת (System Categories) - לאתחול

```typescript
// backend/src/modules/categories/data/system-categories.ts

export const SYSTEM_CATEGORIES = [
  // הכנסות
  { name: 'salary', nameHe: 'משכורת', icon: '💰', isIncome: true, isFixed: true },
  { name: 'bonus', nameHe: 'בונוס', icon: '🎁', isIncome: true },
  { name: 'gifts_received', nameHe: 'מתנות שקיבלתי', icon: '🎀', isIncome: true },
  { name: 'refunds', nameHe: 'החזרים', icon: '↩️', isIncome: true },
  { name: 'other_income', nameHe: 'הכנסות אחרות', icon: '📈', isIncome: true },
  
  // הוצאות קבועות
  { name: 'rent', nameHe: 'שכירות', icon: '🏠', isFixed: true },
  { name: 'mortgage', nameHe: 'משכנתא', icon: '🏦', isFixed: true },
  { name: 'utilities', nameHe: 'חשבונות בית', icon: '💡', isFixed: true },
  { name: 'insurance', nameHe: 'ביטוחים', icon: '🛡️', isFixed: true },
  { name: 'subscriptions', nameHe: 'מנויים', icon: '📺', isFixed: true },
  { name: 'internet_phone', nameHe: 'אינטרנט וסלולר', icon: '📱', isFixed: true },
  { name: 'education', nameHe: 'חינוך', icon: '🎓', isFixed: true },
  { name: 'childcare', nameHe: 'גן/מעון', icon: '👶', isFixed: true },
  
  // קטגוריות במעקב (משתנות תדירות)
  { name: 'groceries', nameHe: 'סופר/מזון', icon: '🛒', isTracked: true },
  { name: 'restaurants', nameHe: 'מסעדות', icon: '🍽️', isTracked: true },
  { name: 'transportation', nameHe: 'תחבורה', icon: '🚌', isTracked: true },
  { name: 'fuel', nameHe: 'דלק', icon: '⛽', isTracked: true },
  { name: 'car', nameHe: 'רכב', icon: '🚗', isTracked: true },
  { name: 'entertainment', nameHe: 'בילויים', icon: '🎬', isTracked: true },
  { name: 'shopping', nameHe: 'קניות', icon: '🛍️', isTracked: true },
  { name: 'clothing', nameHe: 'ביגוד', icon: '👕', isTracked: true },
  { name: 'health', nameHe: 'בריאות', icon: '🏥', isTracked: true },
  { name: 'pharmacy', nameHe: 'בית מרקחת', icon: '💊', isTracked: true },
  { name: 'sports', nameHe: 'ספורט', icon: '🏃', isTracked: true },
  { name: 'pets', nameHe: 'חיות מחמד', icon: '🐕', isTracked: true },
  
  // הוצאות משתנות (חד פעמיות)
  { name: 'gifts_given', nameHe: 'מתנות', icon: '🎁' },
  { name: 'travel', nameHe: 'נסיעות/חופשות', icon: '✈️' },
  { name: 'home_improvement', nameHe: 'שיפוצים', icon: '🔨' },
  { name: 'electronics', nameHe: 'אלקטרוניקה', icon: '💻' },
  { name: 'furniture', nameHe: 'ריהוט', icon: '🛋️' },
  
  // מיוחדות
  { name: 'atm_withdrawal', nameHe: 'משיכת מזומן', icon: '🏧' },
  { name: 'bank_fees', nameHe: 'עמלות בנק', icon: '🏦' },
  { name: 'transfers', nameHe: 'העברות', icon: '↔️' },
  { name: 'uncategorized', nameHe: 'לא מסווג', icon: '❓' },
];

// Keywords for AI categorization hints
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  groceries: ['רמי לוי', 'שופרסל', 'מגה', 'ויקטורי', 'יוחננוף', 'אושר עד', 'סופר', 'מרקט'],
  restaurants: ['מסעדה', 'קפה', 'פיצה', 'סושי', 'מקדונלד', 'בורגר', 'ארומה', 'קופי'],
  fuel: ['דלק', 'סונול', 'פז', 'דור אלון', 'ten', 'yellow'],
  pharmacy: ['סופר פארם', 'בית מרקחת', 'פארם', 'be'],
  subscriptions: ['נטפליקס', 'ספוטיפי', 'אפל', 'גוגל', 'אמזון', 'hbo', 'disney'],
  // ... more keywords
};
```

---

## מודולים מרכזיים - מפרט מפורט

### 1. מודול אימות (Auth Module)

```typescript
// backend/src/modules/auth/auth.service.ts - מפרט

/**
 * AuthService - ניהול אימות משתמשים
 * 
 * פונקציות נדרשות:
 * 
 * register(dto: RegisterDto): Promise<User>
 *   - ולידציה: email ייחודי, סיסמה חזקה (8+ תווים, אות גדולה, מספר, תו מיוחד)
 *   - הצפנת סיסמה: bcrypt עם cost factor 12
 *   - יצירת קטגוריות מערכת למשתמש חדש
 *   - שליחת webhook: user.created
 * 
 * login(dto: LoginDto): Promise<{ accessToken, refreshToken, user }>
 *   - אימות credentials
 *   - Access token: JWT, תוקף 15 דקות, payload: { sub: userId, email, role }
 *   - Refresh token: JWT, תוקף 7 ימים, נשמר ב-HTTP-only cookie
 *   - Audit log: login event
 * 
 * refresh(refreshToken: string): Promise<{ accessToken, refreshToken }>
 *   - Token rotation: יצירת refresh token חדש בכל refresh
 *   - Blacklist של token ישן ב-Redis
 * 
 * logout(userId: string, refreshToken: string): Promise<void>
 *   - הוספת refresh token ל-blacklist ב-Redis
 *   - TTL = זמן תפוגה של ה-token
 * 
 * validateUser(payload: JwtPayload): Promise<User>
 *   - בדיקה שה-user קיים ופעיל
 *   - שימוש ב-guards
 */

// JWT Strategy
/**
 * JwtStrategy - validates access tokens
 * - Extracts token from Authorization header
 * - Validates signature and expiration
 * - Returns user payload
 */

// Guards
/**
 * JwtAuthGuard - protects routes requiring authentication
 * RolesGuard - protects routes by user role (ADMIN, USER, VIEWER)
 */
```

### 2. מודול סקרייפר (Scraper Module)

```typescript
// backend/src/modules/scraper/scraper.service.ts - מפרט

/**
 * ScraperService - ניהול סנכרון מול בנקים
 * 
 * SUPPORTED_COMPANIES - רשימת בנקים נתמכים:
 */
export const SUPPORTED_COMPANIES = [
  { id: 'hapoalim', name: 'בנק הפועלים', type: 'bank', fields: ['userCode', 'password'] },
  { id: 'leumi', name: 'בנק לאומי', type: 'bank', fields: ['username', 'password'] },
  { id: 'discount', name: 'בנק דיסקאונט', type: 'bank', fields: ['id', 'password', 'num'] },
  { id: 'mercantile', name: 'בנק מרכנתיל', type: 'bank', fields: ['id', 'password', 'num'] },
  { id: 'mizrahi', name: 'מזרחי טפחות', type: 'bank', fields: ['username', 'password'] },
  { id: 'otsarHahayal', name: 'אוצר החייל', type: 'bank', fields: ['username', 'password'] },
  { id: 'union', name: 'בנק איגוד', type: 'bank', fields: ['username', 'password'] },
  { id: 'beinleumi', name: 'הבינלאומי', type: 'bank', fields: ['username', 'password'] },
  { id: 'massad', name: 'בנק מסד', type: 'bank', fields: ['username', 'password'] },
  { id: 'yahav', name: 'בנק יהב', type: 'bank', fields: ['username', 'password', 'nationalID'] },
  { id: 'isracard', name: 'ישראכרט', type: 'creditCard', fields: ['id', 'card6Digits', 'password'] },
  { id: 'visaCal', name: 'ויזה כאל', type: 'creditCard', fields: ['username', 'password'] },
  { id: 'max', name: 'מקס', type: 'creditCard', fields: ['username', 'password'] },
  { id: 'amex', name: 'אמריקן אקספרס', type: 'creditCard', fields: ['id', 'card6Digits', 'password'] },
  { id: 'behatsdaa', name: 'בהצדעה', type: 'creditCard', fields: ['id', 'password'] },
  { id: 'beyahadBishvilha', name: 'ביחד בשבילך', type: 'creditCard', fields: [] },
  { id: 'oneZero', name: 'OneZero', type: 'bank', fields: ['email', 'password', 'phoneNumber'], has2FA: true },
  { id: 'pagi', name: 'פאגי', type: 'bank', fields: [] },
];

/**
 * saveScraperConfig(userId, companyId, credentials): Promise<ScraperConfig>
 *   - הצפנת credentials עם AES-256-GCM
 *   - שמירה בטבלת ScraperConfig
 *   - הפעלת סנכרון ראשוני
 * 
 * runScraper(configId: string): Promise<ScrapeResult>
 *   - שליפת config ופענוח credentials
 *   - הרצת createScraper מ-israeli-bank-scrapers
 *   - Options: startDate = 60 יום אחורה (או מתאריך הסנכרון האחרון)
 *   - טיפול בשגיאות: INVALID_PASSWORD, CHANGE_PASSWORD, ACCOUNT_BLOCKED, TIMEOUT
 *   - עדכון lastSyncAt ו-lastSyncStatus
 * 
 * processScrapedTransactions(accountId, transactions[]): Promise<number>
 *   - Deduplication: יצירת scraperHash מ-date+amount+description
 *   - upsert לטבלת transactions
 *   - קריאה ל-OllamaService לקטגוריזציה
 *   - שליחת webhook: transaction.new לכל עסקה חדשה
 *   - שליחת webhook: transaction.large_expense אם amount > threshold
 *   - החזרת מספר עסקאות חדשות
 */

// backend/src/modules/scraper/scraper.processor.ts - BullMQ Worker

/**
 * ScraperProcessor - עיבוד jobs של סנכרון
 * 
 * @Process('sync-account')
 * async handleSync(job: Job<{ configId: string }>)
 *   - הרצת runScraper
 *   - retry: 3 פעמים עם exponential backoff
 *   - timeout: 5 דקות
 * 
 * Scheduled Jobs (cron):
 *   - 'daily-sync': כל יום ב-06:00 - סנכרון כל החשבונות הפעילים
 *   - 'weekly-scraper-update-check': כל יום ראשון ב-03:00 - בדיקת עדכון לספרייה
 *   - Concurrency: 1 (סקרייפר אחד בכל פעם בגלל Puppeteer)
 * 
 * @Process('check-scraper-update')
 * async handleUpdateCheck()
 *   - בדיקה אם יש גרסה חדשה של israeli-bank-scrapers
 *   - אם כן: שליחת webhook + התראה לאדמין
 *   - שמירת תוצאה ב-Redis לתצוגה בממשק
 */
```

### 3. מודול OLLAMA (AI Categorization)

```typescript
// backend/src/modules/ollama/ollama.service.ts - מפרט

/**
 * OllamaService - אינטגרציה עם שרת OLLAMA מקומי (אופציונלי)
 * 
 * CONFIGURATION HIERARCHY (מגבוה לנמוך):
 *   1. UserSettings (אם המשתמש הגדיר override)
 *   2. SystemSettings (הגדרות גלובליות)
 *   3. Environment Variables (fallback)
 *   4. Disabled (אם לא הוגדר כלום)
 * 
 * getOllamaConfig(userId?: string): Promise<OllamaConfig | null>
 *   - בדיקת UserSettings אם userId מסופק
 *   - fallback ל-SystemSettings
 *   - fallback ל-ENV variables
 *   - החזרת null אם OLLAMA לא מופעל
 * 
 * isAvailable(userId?: string): Promise<boolean>
 *   - בדיקה אם OLLAMA מופעל ונגיש
 *   - קריאת health check ל-/api/tags
 *   - Cache תוצאה ל-60 שניות
 * 
 * testConnection(url: string, model?: string): Promise<ConnectionTestResult>
 *   - בדיקת חיבור לכתובת נתונה
 *   - בדיקה שהמודל קיים
 *   - החזרת: { success, latencyMs, availableModels, error? }
 */

interface OllamaConfig {
  enabled: boolean;
  url: string;          // e.g., "http://localhost:11434" or "http://ollama-host:11434"
  model: string;        // e.g., "mistral", "llama3"
  timeout: number;      // milliseconds
}

interface ConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  availableModels?: string[];
  error?: string;
}

/**
 * categorizeTransaction(transaction: Transaction, categories: Category[], userId?: string): Promise<CategorizeResult>
 *   - שליפת config דרך getOllamaConfig(userId)
 *   - אם OLLAMA לא זמין → fallback לכללים סטטיים
 *   - בניית prompt עם תיאור העסקה ורשימת הקטגוריות
 *   - קריאה ל-{ollamaUrl}/api/generate
 *   - פרסור התשובה לקבלת קטגוריה ו-confidence score
 *   - fallback: 'uncategorized' אם confidence < threshold
 * 
 * FALLBACK CATEGORIZATION (כשOLLAMA לא זמין):
 *   - חיפוש keywords בתיאור העסקה
 *   - התאמה לקטגוריות לפי CATEGORY_KEYWORDS
 *   - confidence: 0.7 להתאמה מדויקת, 0.4 להתאמה חלקית
 */

interface CategorizeResult {
  categoryId: string;
  confidence: number;
  method: 'ollama' | 'rules' | 'fallback';  // איך בוצע הסיווג
}

/**
 * batchCategorize(transactions: Transaction[], userId?: string): Promise<CategorizeResult[]>
 *   - אם OLLAMA זמין: עיבוד מקבילי עם Promise.all (מקסימום 5 במקביל)
 *   - אם לא: שימוש בכללים סטטיים (מהיר יותר)
 *   - שמירת תוצאות בטבלת transactions
 * 
 * generateForecast(userId: string, month: number, year: number): Promise<Forecast>
 *   - אם OLLAMA לא זמין: שימוש בממוצעים היסטוריים פשוטים
 *   - אם זמין: שליפת היסטוריית עסקאות (6 חודשים אחורה)
 *   - בניית prompt עם סיכום הוצאות לפי קטגוריה וחודש
 *   - בקשה מ-OLLAMA לחזות הוצאות לחודש הנוכחי
 *   - החזרת תחזית לפי קטגוריה
 * 
 * learnFromCorrection(transactionId: string, oldCategoryId: string, newCategoryId: string): void
 *   - שמירת התיקון ללמידה עתידית
 *   - עדכון keywords של הקטגוריה הנכונה
 */

// Prompt Templates
export const CATEGORIZE_PROMPT = `
אתה מערכת לסיווג עסקאות פיננסיות. 
קיבלת עסקה עם התיאור הבא: "{description}"
הסכום: {amount} ש"ח
התאריך: {date}

הקטגוריות האפשריות הן:
{categories}

החזר תשובה בפורמט JSON בלבד:
{"categoryId": "xxx", "confidence": 0.XX}

בחר את הקטגוריה המתאימה ביותר.
`;

export const FORECAST_PROMPT = `
אתה מערכת לחיזוי הוצאות חודשיות.
להלן היסטוריית ההוצאות של המשתמש ב-6 החודשים האחרונים:

{history}

חזה את ההוצאות הצפויות לחודש {month}/{year} לפי קטגוריה.
התחשב בדפוסים עונתיים ומגמות.

החזר תשובה בפורמט JSON:
{"categories": [{"categoryId": "xxx", "predictedAmount": XXX}, ...], "totalPredicted": XXXX}
`;
```

### 4. מודול OCR

```typescript
// backend/src/modules/ocr/ocr.service.ts - מפרט

/**
 * OCRService - חילוץ נתונים מקבלות
 * 
 * Dependencies: Tesseract.js עם תמיכה בעברית
 * 
 * processReceipt(imageBuffer: Buffer): Promise<ReceiptData>
 *   - הרצת OCR עם שפה עברית + אנגלית
 *   - זיהוי patterns: סכום (₪, שח, NIS), תאריך, שם בית עסק
 *   - שימוש ב-OLLAMA לחילוץ חכם אם הזיהוי הבסיסי נכשל
 *   - החזרת: { amount, date, merchant, confidence, rawText }
 * 
 * createTransactionFromReceipt(userId: string, receiptData: ReceiptData): Promise<Transaction>
 *   - יצירת עסקה ידנית עם isManual: true
 *   - קטגוריזציה אוטומטית דרך OLLAMA
 *   - שליחת webhook: transaction.manual_created
 */

// backend/src/modules/ocr/ocr.controller.ts

/**
 * POST /api/v1/ocr/scan
 *   - קבלת תמונה (multipart/form-data)
 *   - מגבלת גודל: 10MB
 *   - פורמטים נתמכים: JPEG, PNG, WebP
 *   - החזרת ReceiptData לאישור המשתמש
 * 
 * POST /api/v1/ocr/confirm
 *   - קבלת ReceiptData (מתוקן אם צריך) מהמשתמש
 *   - יצירת Transaction
 */
```

### 5. מודול Dashboard

```typescript
// backend/src/modules/dashboard/dashboard.service.ts - מפרט

/**
 * DashboardService - חישוב נתוני דשבורד
 * 
 * getCashFlowSummary(userId: string, month: number, year: number): Promise<CashFlowSummary>
 *   - חישוב סך הכנסות (עסקאות עם amount > 0)
 *   - חישוב הוצאות קבועות (קטגוריות עם isFixed: true)
 *   - חישוב קטגוריות במעקב (קטגוריות עם isTracked: true)
 *   - חישוב הוצאות משתנות (כל השאר)
 *   - חישוב "כמה נשאר להוציא": הכנסות - כל ההוצאות
 *   - Caching ב-Redis עם TTL של 5 דקות
 * 
 * getWeeklyBreakdown(userId: string, month: number, year: number): Promise<WeeklyBreakdown[]>
 *   - חלוקת ההוצאות לפי שבועות
 *   - שבוע = א'-ש'
 * 
 * getCategoryBreakdown(userId: string, month: number, year: number): Promise<CategoryBreakdown[]>
 *   - סיכום הוצאות לפי קטגוריה
 *   - כולל אחוז מסך ההוצאות
 *   - כולל השוואה לחודש קודם
 * 
 * getForecast(userId: string): Promise<MonthlyForecast>
 *   - קריאה ל-OllamaService.generateForecast
 *   - שילוב עם נתונים אמיתיים (מה כבר קרה החודש)
 *   - חישוב תחזית מעודכנת לסיום החודש
 * 
 * getTrends(userId: string, months: number = 6): Promise<TrendData[]>
 *   - נתונים לגרף מגמות
 *   - הכנסות, הוצאות, חיסכון לאורך זמן
 */

// Response Types
interface CashFlowSummary {
  month: number;
  year: number;
  income: {
    total: number;
    fixed: number;
    variable: number;
  };
  expenses: {
    total: number;
    fixed: number;
    tracked: number;
    variable: number;
  };
  remaining: number;  // "כמה נשאר להוציא"
  forecastedEndOfMonth: number;
  comparedToLastMonth: {
    income: number;      // percentage change
    expenses: number;
    remaining: number;
  };
}
```

### 6. מודול Webhooks

```typescript
// backend/src/modules/webhooks/webhooks.service.ts - מפרט

/**
 * WebhooksService - שליחת אירועים ל-n8n
 * 
 * Event Types:
 */
export enum WebhookEvent {
  // Transactions
  TRANSACTION_NEW = 'transaction.new',
  TRANSACTION_LARGE_EXPENSE = 'transaction.large_expense',
  TRANSACTION_MANUAL_CREATED = 'transaction.manual_created',
  
  // Budgets
  BUDGET_WARNING = 'budget.warning',      // 80% of budget
  BUDGET_EXCEEDED = 'budget.exceeded',    // 100% of budget
  
  // Sync
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  
  // Account
  ACCOUNT_LOW_BALANCE = 'account.low_balance',
  
  // Reports
  SUMMARY_WEEKLY = 'summary.weekly',
  SUMMARY_MONTHLY = 'summary.monthly',
  
  // User
  USER_CREATED = 'user.created',
  
  // System (Admin)
  SCRAPER_UPDATE_AVAILABLE = 'system.scraper_update_available',  // גרסה חדשה זמינה
}

/**
 * emit(userId: string, event: WebhookEvent, data: any): Promise<void>
 *   - שליפת webhook configs פעילים למשתמש שמאזינים ל-event הזה
 *   - בניית payload עם timestamp ו-meta
 *   - חתימת HMAC-SHA256 על ה-payload
 *   - שליחת HTTP POST עם header X-Webhook-Signature
 *   - Retry: 3 פעמים עם exponential backoff
 *   - לוג של success/failure
 * 
 * Payload Structure:
 */
interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;  // ISO 8601
  data: any;
  meta: {
    userId: string;
    appVersion: string;
    webhookId: string;
  };
}

// HMAC Signing
function signPayload(payload: WebhookPayload, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

---

## PWA Configuration

### manifest.json

```json
{
  "name": "ניהול פיננסי אישי",
  "short_name": "Finance",
  "description": "אפליקציה לניהול פיננסי אישי עם סנכרון בנקים ותחזיות AI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "lang": "he",
  "dir": "rtl",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["finance", "productivity"],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Service Worker (Workbox)

```typescript
// frontend/src/sw.ts

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// API calls - Network First with fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Dashboard data - Stale While Revalidate for better UX
registerRoute(
  ({ url }) => url.pathname.includes('/dashboard'),
  new StaleWhileRevalidate({
    cacheName: 'dashboard-cache',
  })
);

// Static assets - Cache First
registerRoute(
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Background sync for offline transaction creation
const bgSyncPlugin = new BackgroundSyncPlugin('transactionQueue', {
  maxRetentionTime: 24 * 60, // 24 hours
});

registerRoute(
  ({ url }) => url.pathname === '/api/v1/transactions' && request.method === 'POST',
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'התראה';
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    dir: 'rtl',
    lang: 'he',
    data: data.url,
    actions: data.actions || [],
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
```

---

## Docker Compose Configuration

```yaml
# docker-compose.yml
# ================================================
# Self-Hosted Personal Finance App
# Just run: docker-compose up -d
# ================================================

version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: finance-backend
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - DATABASE_URL=postgresql://finance:${DB_PASSWORD}@db:5432/finance_app
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
      # OLLAMA - Optional, configured via UI
      - OLLAMA_ENABLED=${OLLAMA_ENABLED:-false}
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-}
      - OLLAMA_MODEL=${OLLAMA_MODEL:-mistral}
      - OLLAMA_TIMEOUT=${OLLAMA_TIMEOUT:-30000}
      # n8n - Optional, configured via UI
      - N8N_ENABLED=${N8N_ENABLED:-false}
      - N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL:-}
      - N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET:-}
      # Email - Optional fallback for notifications
      - SMTP_ENABLED=${SMTP_ENABLED:-false}
      - SMTP_HOST=${SMTP_HOST:-}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASS=${SMTP_PASS:-}
      - SMTP_FROM=${SMTP_FROM:-noreply@example.com}
      # App settings
      - LARGE_EXPENSE_THRESHOLD=${LARGE_EXPENSE_THRESHOLD:-500}
      - DAILY_SYNC_CRON=${DAILY_SYNC_CRON:-0 6 * * *}
      # First admin (optional)
      - ADMIN_EMAIL=${ADMIN_EMAIL:-}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads
    networks:
      - finance-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=/api
    container_name: finance-frontend
    restart: unless-stopped
    networks:
      - finance-network

  nginx:
    image: nginx:alpine
    container_name: finance-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    networks:
      - finance-network

  db:
    image: postgres:16-alpine
    container_name: finance-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=finance
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=finance_app
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U finance -d finance_app"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - finance-network

  redis:
    image: redis:7-alpine
    container_name: finance-redis
    restart: unless-stopped
    command: >
      redis-server 
      --maxmemory 256mb 
      --maxmemory-policy allkeys-lru
      --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - finance-network

  # Optional: Bull Board for queue monitoring
  bull-board:
    image: deadly0/bull-board
    container_name: finance-bull-board
    restart: unless-stopped
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    ports:
      - "3001:3000"
    depends_on:
      - redis
    networks:
      - finance-network

volumes:
  pgdata:
  redisdata:

networks:
  finance-network:
    driver: bridge
```

### Nginx Configuration

```nginx
# nginx/default.conf

upstream backend {
    server backend:3000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 80;
    server_name _;
    
    # Redirect to HTTPS in production
    # return 301 https://$server_name$request_uri;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # API routes
    location /api/ {
        proxy_pass http://backend/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout for scraper operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # File upload limit for OCR
        client_max_body_size 10M;
    }
    
    # Frontend (PWA)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # PWA caching
        location ~* \.(?:css|js|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|ico|webp)$ {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Service Worker - no cache
        location = /sw.js {
            proxy_pass http://frontend;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # Manifest - short cache
        location = /manifest.json {
            proxy_pass http://frontend;
            add_header Cache-Control "max-age=86400";
        }
    }
}
```

---

## Environment Variables

```bash
# .env.example
# ================================================
# העתק קובץ זה ל-.env ועדכן את הערכים
# ================================================

# ===================
# Database (חובה)
# ===================
DB_PASSWORD=change_me_to_secure_password

# ===================
# JWT Authentication (חובה)
# ===================
# Generate with: openssl rand -hex 32
JWT_SECRET=change_me_generate_with_openssl_rand_hex_32
JWT_REFRESH_SECRET=change_me_generate_different_secret

# ===================
# Encryption (חובה)
# ===================
# Generate with: openssl rand -hex 32
# Used for encrypting bank credentials
ENCRYPTION_MASTER_KEY=change_me_64_char_hex_string

# ===================
# OLLAMA AI (אופציונלי)
# ===================
# ניתן להגדיר גם דרך ממשק המשתמש
# השאר ריק לכיבוי ברירת מחדל
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=
OLLAMA_MODEL=mistral
OLLAMA_TIMEOUT=30000

# ===================
# n8n Integration (אופציונלי)
# ===================
# ניתן להגדיר גם דרך ממשק המשתמש
# השאר ריק לכיבוי ברירת מחדל
N8N_ENABLED=false
N8N_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=change_me_if_using_n8n

# ===================
# Email Notifications (אופציונלי)
# ===================
# להתראות באימייל כשn8n לא מוגדר
SMTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com

# ===================
# Application Settings
# ===================
# סף להתראה על הוצאה גדולה (בש"ח)
LARGE_EXPENSE_THRESHOLD=500

# שעת סנכרון יומי (cron format)
DAILY_SYNC_CRON=0 6 * * *

# ===================
# Server Settings
# ===================
PORT=3000
NODE_ENV=production

# ===================
# First Admin User (אופציונלי)
# ===================
# ייצור משתמש אדמין ראשון בהפעלה ראשונה
# אם לא מוגדר, תצטרך להירשם דרך הממשק
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

---

## API Endpoints Summary

```
Authentication:
POST   /api/v1/auth/register     - הרשמה
POST   /api/v1/auth/login        - התחברות
POST   /api/v1/auth/refresh      - רענון token
POST   /api/v1/auth/logout       - התנתקות
GET    /api/v1/auth/me           - פרטי משתמש נוכחי

Users:
GET    /api/v1/users/profile     - פרופיל
PATCH  /api/v1/users/profile     - עדכון פרופיל
POST   /api/v1/users/invite      - הזמנת משתמש למשק בית

Accounts:
GET    /api/v1/accounts          - רשימת חשבונות
POST   /api/v1/accounts          - הוספת חשבון (scraper config)
GET    /api/v1/accounts/:id      - פרטי חשבון
DELETE /api/v1/accounts/:id      - מחיקת חשבון
POST   /api/v1/accounts/:id/sync - סנכרון ידני

Transactions:
GET    /api/v1/transactions      - רשימת עסקאות (עם filters)
GET    /api/v1/transactions/:id  - פרטי עסקה
PATCH  /api/v1/transactions/:id  - עדכון עסקה (קטגוריה, הערות)
POST   /api/v1/transactions      - עסקה ידנית
DELETE /api/v1/transactions/:id  - מחיקת עסקה ידנית

Categories:
GET    /api/v1/categories        - רשימת קטגוריות
POST   /api/v1/categories        - קטגוריה חדשה
PATCH  /api/v1/categories/:id    - עדכון קטגוריה
DELETE /api/v1/categories/:id    - מחיקת קטגוריה

Budgets:
GET    /api/v1/budgets           - תקציבים
GET    /api/v1/budgets/:month/:year - תקציב לחודש
POST   /api/v1/budgets           - הגדרת תקציב
PATCH  /api/v1/budgets/:id       - עדכון תקציב

Dashboard:
GET    /api/v1/dashboard/summary      - סיכום תזרים
GET    /api/v1/dashboard/weekly       - חלוקה שבועית
GET    /api/v1/dashboard/categories   - חלוקה לקטגוריות
GET    /api/v1/dashboard/forecast     - תחזית
GET    /api/v1/dashboard/trends       - מגמות

OCR:
POST   /api/v1/ocr/scan          - סריקת קבלה
POST   /api/v1/ocr/confirm       - אישור ויצירת עסקה

Reports:
GET    /api/v1/reports/monthly   - דוח חודשי
GET    /api/v1/reports/export    - ייצוא לאקסל

Webhooks:
GET    /api/v1/webhooks          - רשימת webhooks
POST   /api/v1/webhooks          - הגדרת webhook
DELETE /api/v1/webhooks/:id      - מחיקת webhook
POST   /api/v1/webhooks/:id/test - בדיקת webhook

Settings:
GET    /api/v1/settings          - הגדרות משתמש
PATCH  /api/v1/settings          - עדכון הגדרות
GET    /api/v1/settings/ollama   - הגדרות OLLAMA
PATCH  /api/v1/settings/ollama   - עדכון הגדרות OLLAMA
POST   /api/v1/settings/ollama/test - בדיקת חיבור OLLAMA
GET    /api/v1/settings/ollama/models - רשימת מודלים זמינים
GET    /api/v1/settings/n8n      - הגדרות n8n
PATCH  /api/v1/settings/n8n      - עדכון הגדרות n8n
POST   /api/v1/settings/n8n/test - בדיקת webhook n8n
GET    /api/v1/settings/email    - הגדרות SMTP
PATCH  /api/v1/settings/email    - עדכון הגדרות SMTP
POST   /api/v1/settings/email/test - שליחת מייל בדיקה

Admin (ADMIN role only):
GET    /api/v1/admin/users       - כל המשתמשים
GET    /api/v1/admin/stats       - סטטיסטיקות מערכת
GET    /api/v1/admin/settings    - הגדרות מערכת גלובליות
PATCH  /api/v1/admin/settings    - עדכון הגדרות מערכת
GET    /api/v1/admin/scraper-status - סטטוס וגרסת israeli-bank-scrapers
POST   /api/v1/admin/scraper-update - עדכון israeli-bank-scrapers לגרסה אחרונה
```

---

## Frontend Pages & Components

### Main Pages

1. **DashboardPage** - מסך ראשי
   - CashFlowCard: "כמה נשאר להוציא" בפונט גדול, צבע ירוק/אדום
   - WeeklyBreakdown: פירוט הוצאות שבועי
   - CategoryChart: pie chart של הוצאות לפי קטגוריה
   - TrendChart: area chart של תזרים לאורך חודשים
   - QuickActions: כפתורים מהירים (הוספת עסקה, סריקת קבלה)

2. **TransactionsPage** - רשימת עסקאות
   - TransactionFilters: תאריכים, קטגוריה, חשבון, חיפוש
   - TransactionList: טבלה עם infinite scroll
   - TransactionRow: תאריך, תיאור, סכום, קטגוריה (editable), הערות

3. **AccountsPage** - ניהול חשבונות
   - AccountsList: כרטיסים של כל החשבונות
   - AccountCard: שם מוסד, מספר חשבון, יתרה, סטטוס סנכרון
   - AddAccountModal: בחירת מוסד, הזנת credentials

4. **BudgetsPage** - ניהול תקציבים
   - BudgetOverview: סיכום ניצול תקציב כללי
   - BudgetCategoryRow: קטגוריה, תקציב, שימוש, progress bar

5. **ReportsPage** - דוחות
   - MonthSelector
   - MonthlyReport: סיכום מפורט
   - ExportButton: ייצוא לאקסל

6. **SettingsPage** - הגדרות
   - ProfileSettings
   - NotificationSettings
   - **IntegrationsSettings** - הגדרות אינטגרציות:
     - **OllamaSettings**: הפעלה, URL, מודל, בדיקת חיבור
     - **N8nSettings**: הפעלה, webhook URL, secret, בדיקת חיבור
     - **EmailSettings**: SMTP configuration (fallback להתראות)
   - WebhookSettings
   - HouseholdSettings
   - **AppearanceSettings** - מראה: theme (light/dark/system), שפה

7. **AdminPage** - ניהול מערכת (ADMIN בלבד)
   - **ScraperStatusCard** - סטטוס israeli-bank-scrapers:
     - גרסה מותקנת vs גרסה אחרונה
     - Badge אם יש עדכון זמין
     - כפתור "עדכן עכשיו"
     - רשימת בנקים נתמכים
   - UsersManagement
   - SystemStats

### Design System

```typescript
// Design tokens
const colors = {
  positive: '#22c55e',  // Green - income, surplus
  negative: '#ef4444',  // Red - expenses, deficit
  warning: '#f59e0b',   // Orange - budget warning
  primary: '#3b82f6',   // Blue - actions
  background: '#0f172a', // Dark background (dark mode)
  surface: '#1e293b',
  text: '#f8fafc',
  textMuted: '#94a3b8',
};

// Typography
const typography = {
  heroNumber: 'text-5xl font-bold tabular-nums',
  sectionTitle: 'text-xl font-semibold',
  categoryLabel: 'text-sm font-medium',
  amount: 'text-lg font-semibold tabular-nums',
};

// Animation
// Use Framer Motion for:
// - Page transitions
// - Number counting animations (remaining budget)
// - Chart animations
// - Pull-to-refresh
```

### OllamaSettings Component Specification

```tsx
// frontend/src/components/settings/OllamaSettings.tsx

/**
 * OllamaSettings - קומפוננטה להגדרת חיבור OLLAMA
 * 
 * State:
 *   - enabled: boolean
 *   - url: string (e.g., "http://localhost:11434" or "http://your-ollama-host:11434")
 *   - model: string (e.g., "mistral")
 *   - connectionStatus: 'unknown' | 'testing' | 'connected' | 'error'
 *   - availableModels: string[]
 *   - latency: number | null
 *   - errorMessage: string | null
 * 
 * UI Elements:
 *   1. Toggle Switch: "הפעל קטגוריזציה חכמה עם AI"
 *      - כשכבוי: הצגת הודעה "המערכת תשתמש בכללים אוטומטיים לסיווג עסקאות"
 *   
 *   2. URL Input (מוצג רק כש-enabled):
 *      - Label: "כתובת שרת OLLAMA"
 *      - Placeholder: "http://localhost:11434"
 *      - Helper text: "הזן את כתובת שרת ה-OLLAMA שלך (מקומי או מרוחק)"
 *      - Validation: URL format
 *   
 *   3. Model Selector (מוצג רק כש-enabled):
 *      - Label: "מודל AI"
 *      - Dropdown עם מודלים זמינים (נטען אחרי בדיקת חיבור)
 *      - אפשרות להקלדה ידנית
 *      - Default: mistral
 *   
 *   4. Test Connection Button:
 *      - Text: "בדוק חיבור"
 *      - Loading state בזמן בדיקה
 *   
 *   5. Connection Status Card:
 *      - Icon: ירוק אם מחובר, אדום אם שגיאה, אפור אם לא נבדק
 *      - Latency: "זמן תגובה: XXms"
 *      - Available Models: רשימת מודלים אם מחובר
 *      - Error Message: הודעת שגיאה אם נכשל
 *   
 *   6. Fallback Toggle:
 *      - Label: "השתמש בכללים אוטומטיים כשAI לא זמין"
 *      - Default: true
 *   
 *   7. Save Button:
 *      - שמירת ההגדרות
 *      - Disabled אם אין שינויים
 * 
 * API Calls:
 *   - GET /api/v1/settings/ollama - טעינת הגדרות נוכחיות
 *   - POST /api/v1/settings/ollama/test - בדיקת חיבור
 *   - GET /api/v1/settings/ollama/models - רשימת מודלים (אחרי חיבור מוצלח)
 *   - PATCH /api/v1/settings/ollama - שמירת הגדרות
 */
```

### N8nSettings Component Specification

```tsx
// frontend/src/components/settings/N8nSettings.tsx

/**
 * N8nSettings - קומפוננטה להגדרת חיבור n8n
 * 
 * State:
 *   - enabled: boolean
 *   - webhookUrl: string (e.g., "http://localhost:5678/webhook/finance")
 *   - webhookSecret: string
 *   - connectionStatus: 'unknown' | 'testing' | 'connected' | 'error'
 *   - lastTestResult: { success: boolean, message: string } | null
 * 
 * UI Elements:
 *   1. Toggle Switch: "הפעל אינטגרציה עם n8n"
 *      - כשכבוי: הצגת הודעה "התראות ישלחו במייל או יוצגו באפליקציה בלבד"
 *   
 *   2. Webhook URL Input (מוצג רק כש-enabled):
 *      - Label: "כתובת Webhook"
 *      - Placeholder: "http://localhost:5678/webhook/finance"
 *      - Helper text: "צור Webhook node ב-n8n והדבק את הכתובת כאן"
 *   
 *   3. Webhook Secret Input:
 *      - Label: "סוד לחתימה (HMAC)"
 *      - Type: password עם toggle visibility
 *      - Generate button: יצירת סוד אקראי
 *      - Helper text: "הגדר את אותו סוד ב-n8n לאימות הודעות"
 *   
 *   4. Test Connection Button:
 *      - שולח אירוע test ל-webhook
 *   
 *   5. Events Selection:
 *      - Checkboxes לבחירת אילו אירועים לשלוח:
 *        - [ ] עסקה חדשה
 *        - [x] הוצאה גדולה (מעל הסף)
 *        - [x] חריגה מתקציב
 *        - [x] אזהרת תקציב (80%)
 *        - [ ] סנכרון הושלם
 *        - [x] סנכרון נכשל
 *        - [x] סיכום שבועי
 *        - [x] סיכום חודשי
 * 
 * API Calls:
 *   - GET /api/v1/settings/n8n - טעינת הגדרות
 *   - PATCH /api/v1/settings/n8n - שמירת הגדרות
 *   - POST /api/v1/settings/n8n/test - שליחת אירוע בדיקה
 */
```

---

## הנחיות חשובות לפיתוח

### אבטחה - חובה!

1. **הצפנת Credentials**: AES-256-GCM עם IV ייחודי לכל הצפנה
2. **JWT**: Access token קצר (15 דק), Refresh token ב-HTTP-only cookie
3. **HTTPS**: חובה בפרודקשן
4. **Rate Limiting**: 100 req/min לAPI, 5 req/min ל-login
5. **Input Validation**: Zod בכל endpoint
6. **SQL Injection**: Prisma מונע אוטומטית
7. **User Scoping**: כל שאילתה חייבת לכלול userId

### ביצועים

1. **Caching**: Redis ל-dashboard aggregations (TTL 5 דק)
2. **Pagination**: cursor-based לעסקאות
3. **Lazy Loading**: קומפוננטות כבדות (charts)
4. **Image Optimization**: WebP לקבלות
5. **DB Indexes**: על כל שדה שמשמש ב-WHERE

### PWA

1. **Offline**: Cache dashboard data, allow viewing
2. **Background Sync**: queue עסקאות שנוצרו offline
3. **Push Notifications**: budget alerts, sync status
4. **Install Prompt**: הצגה לאחר 3 ביקורים

### RTL & i18n

1. **dir="rtl"** על html element
2. **Tailwind RTL**: שימוש ב-ms-* ו-me-* במקום ml-* ו-mr-*
3. **Icons**: לוודא שאייקונים לא מתהפכים
4. **Numbers**: tabular-nums לתצוגה נכונה
5. **Dates**: פורמט עברי (יום/חודש/שנה)

---

## שלבי פיתוח מפורטים

### Phase 1: Foundation (שבוע 1-2)

#### 1.1 אתחול הפרויקט

```bash
# יצירת מבנה התיקיות
mkdir -p finance-app/{backend,frontend,nginx,docs}
cd finance-app

# אתחול Backend
cd backend
npm init -y
npm install @nestjs/cli -g
nest new . --package-manager npm --skip-git

# התקנת dependencies בסיסיים
npm install @nestjs/platform-fastify fastify
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @prisma/client prisma
npm install class-validator class-transformer
npm install bcrypt uuid
npm install @types/bcrypt @types/uuid -D

# אתחול Prisma
npx prisma init

# אתחול Frontend
cd ../frontend
npm create vite@latest . -- --template react-ts
npm install
npm install @tanstack/react-query @tanstack/react-table
npm install react-hook-form @hookform/resolvers zod
npm install recharts
npm install i18next react-i18next
npm install zustand
npm install axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# התקנת shadcn/ui
npx shadcn@latest init
```

#### 1.2 הגדרת Prisma Schema

צור את הקובץ `backend/prisma/schema.prisma` עם כל הטבלאות שמפורטות בסכמה למעלה.

**משימות:**
- [ ] העתק את כל ה-models מהסכמה
- [ ] הרץ `npx prisma migrate dev --name init`
- [ ] הרץ `npx prisma generate`
- [ ] צור seed file לקטגוריות מערכת

```typescript
// backend/prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import { SYSTEM_CATEGORIES } from '../src/modules/categories/data/system-categories';

const prisma = new PrismaClient();

async function main() {
  // Create system categories
  for (const category of SYSTEM_CATEGORIES) {
    await prisma.category.upsert({
      where: { 
        userId_name: { userId: null, name: category.name } 
      },
      update: {},
      create: {
        ...category,
        isSystem: true,
        userId: null,
      },
    });
  }
  
  // Create default system settings
  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      ollamaEnabled: false,
      n8nEnabled: false,
      smtpEnabled: false,
      useFallbackRules: true,
      aiConfidenceThreshold: 0.5,
    },
  });
  
  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

#### 1.3 הגדרת NestJS עם Fastify

```typescript
// backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
```

```typescript
// backend/src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
```

#### 1.4 מודול Prisma

```typescript
// backend/src/common/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
// backend/src/common/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

#### 1.5 מודול אימות (Auth Module)

```typescript
// backend/src/modules/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// backend/src/modules/auth/auth.service.ts

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('משתמש עם אימייל זה כבר קיים');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    // Create user settings
    await this.prisma.userSettings.create({
      data: { userId: user.id },
    });

    // Copy system categories to user
    const systemCategories = await this.prisma.category.findMany({
      where: { isSystem: true },
    });

    for (const cat of systemCategories) {
      await this.prisma.category.create({
        data: {
          userId: user.id,
          name: cat.name,
          nameHe: cat.nameHe,
          icon: cat.icon,
          color: cat.color,
          isIncome: cat.isIncome,
          isFixed: cat.isFixed,
          isTracked: cat.isTracked,
          keywords: cat.keywords,
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refresh(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
```

```typescript
// backend/src/modules/auth/auth.controller.ts

import { Controller, Post, Body, UseGuards, Req, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.authService.register(dto);
    
    // Set refresh token as HTTP-only cookie
    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.authService.login(dto);
    
    res.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: { sub: string; email: string },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const tokens = await this.authService.refresh(user.sub, user.email);
    
    res.setCookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return { message: 'התנתקת בהצלחה' };
  }
}
```

```typescript
// backend/src/modules/auth/dto/register.dto.ts

import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'אנא הכנס כתובת אימייל תקינה' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'שם חייב להכיל לפחות 2 תווים' })
  name: string;

  @IsString()
  @MinLength(8, { message: 'סיסמה חייבת להכיל לפחות 8 תווים' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'סיסמה חייבת להכיל אות גדולה, אות קטנה, מספר ותו מיוחד',
  })
  password: string;
}
```

```typescript
// backend/src/modules/auth/dto/login.dto.ts

import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'אנא הכנס כתובת אימייל תקינה' })
  email: string;

  @IsString()
  password: string;
}
```

```typescript
// backend/src/modules/auth/strategies/jwt.strategy.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        householdId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('משתמש לא נמצא');
    }

    return user;
  }
}
```

```typescript
// backend/src/modules/auth/strategies/jwt-refresh.strategy.ts

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: FastifyRequest) => {
          return request?.cookies?.refreshToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    return payload;
  }
}
```

```typescript
// backend/src/common/guards/jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// backend/src/common/guards/jwt-refresh.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
```

```typescript
// backend/src/common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

#### 1.6 הגדרת Frontend בסיסי

```typescript
// frontend/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';
import './i18n/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

```typescript
// frontend/src/App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import BudgetsPage from './pages/BudgetsPage';
import SettingsPage from './pages/SettingsPage';
import LoadingSpinner from './components/common/LoadingSpinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="settings/*" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
```

```typescript
// frontend/src/services/api.ts

import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

// Request interceptor - add auth header
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        useAuthStore.getState().setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

```typescript
// frontend/src/store/auth.store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }), // Don't persist token
    }
  )
);
```

```typescript
// frontend/src/hooks/useAuth.ts

import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

export function useAuth() {
  const navigate = useNavigate();
  const { user, accessToken, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await api.post('/auth/login', data);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; password: string }) => {
      const response = await api.post('/auth/register', data);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      navigate('/dashboard');
    },
  });

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      storeLogout();
      navigate('/login');
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    login: loginMutation.mutate,
    loginError: loginMutation.error,
    register: registerMutation.mutate,
    registerError: registerMutation.error,
    logout,
  };
}
```

```css
/* frontend/src/styles/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* RTL Support */
html {
  direction: rtl;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--muted));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground));
  border-radius: 4px;
}

/* Tabular numbers for financial data */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Amount colors */
.amount-positive {
  @apply text-green-500;
}

.amount-negative {
  @apply text-red-500;
}
```

```typescript
// frontend/src/i18n/i18n.ts

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import he from './locales/he.json';

i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he },
  },
  lng: 'he',
  fallbackLng: 'he',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

```json
// frontend/src/i18n/locales/he.json

{
  "common": {
    "loading": "טוען...",
    "save": "שמור",
    "cancel": "ביטול",
    "delete": "מחק",
    "edit": "ערוך",
    "add": "הוסף",
    "search": "חיפוש",
    "filter": "סינון",
    "export": "ייצוא",
    "back": "חזרה",
    "next": "הבא",
    "previous": "הקודם",
    "confirm": "אישור",
    "close": "סגור"
  },
  "auth": {
    "login": "התחברות",
    "register": "הרשמה",
    "logout": "התנתקות",
    "email": "אימייל",
    "password": "סיסמה",
    "name": "שם",
    "forgotPassword": "שכחתי סיסמה",
    "noAccount": "אין לך חשבון?",
    "hasAccount": "יש לך חשבון?",
    "loginButton": "התחבר",
    "registerButton": "הירשם"
  },
  "nav": {
    "dashboard": "לוח בקרה",
    "transactions": "עסקאות",
    "accounts": "חשבונות",
    "budgets": "תקציבים",
    "reports": "דוחות",
    "settings": "הגדרות"
  },
  "dashboard": {
    "title": "לוח בקרה",
    "remaining": "נשאר להוציא",
    "income": "הכנסות",
    "expenses": "הוצאות",
    "fixedExpenses": "הוצאות קבועות",
    "trackedCategories": "קטגוריות במעקב",
    "variableExpenses": "הוצאות משתנות",
    "thisMonth": "החודש",
    "forecast": "תחזית לסוף החודש",
    "weeklyBreakdown": "פירוט שבועי",
    "categoryBreakdown": "פירוט לפי קטגוריה"
  },
  "transactions": {
    "title": "עסקאות",
    "date": "תאריך",
    "description": "תיאור",
    "amount": "סכום",
    "category": "קטגוריה",
    "account": "חשבון",
    "status": "סטטוס",
    "pending": "ממתין",
    "completed": "הושלם",
    "noTransactions": "אין עסקאות להצגה",
    "addManual": "הוסף עסקה ידנית"
  },
  "accounts": {
    "title": "חשבונות",
    "addAccount": "הוסף חשבון",
    "bank": "בנק",
    "creditCard": "כרטיס אשראי",
    "balance": "יתרה",
    "lastSync": "סנכרון אחרון",
    "sync": "סנכרן",
    "syncing": "מסנכרן...",
    "syncSuccess": "סנכרון הושלם",
    "syncError": "שגיאה בסנכרון"
  },
  "budgets": {
    "title": "תקציבים",
    "setBudget": "הגדר תקציב",
    "spent": "הוצאת",
    "of": "מתוך",
    "remaining": "נותר",
    "exceeded": "חריגה",
    "onTrack": "במסלול"
  },
  "settings": {
    "title": "הגדרות",
    "profile": "פרופיל",
    "notifications": "התראות",
    "integrations": "אינטגרציות",
    "webhooks": "Webhooks",
    "household": "משק בית",
    "appearance": "מראה",
    "ollama": "AI (OLLAMA)",
    "n8n": "n8n",
    "email": "אימייל"
  },
  "errors": {
    "generic": "אירעה שגיאה, נסה שוב",
    "network": "שגיאת רשת, בדוק את החיבור",
    "unauthorized": "אנא התחבר מחדש",
    "notFound": "הדף לא נמצא"
  }
}
```

**משימות Phase 1:**
- [ ] אתחול פרויקט Backend עם NestJS + Fastify
- [ ] אתחול פרויקט Frontend עם Vite + React
- [ ] הגדרת Prisma Schema מלא
- [ ] יצירת migration ראשוני
- [ ] מודול Auth עם register, login, refresh, logout
- [ ] JWT Strategy + Refresh Strategy
- [ ] Guards ו-Decorators
- [ ] הגדרת React Router
- [ ] Axios instance עם interceptors
- [ ] Zustand store לאימות
- [ ] useAuth hook
- [ ] דפי Login ו-Register בסיסיים
- [ ] Layout בסיסי עם RTL
- [ ] קובץ תרגום עברית

---

### Phase 2: Core Features (שבוע 3-4)

#### 2.1 מודול Scraper

```bash
# התקנת dependencies
cd backend
npm install github:HirezRa/israeli-bank-scrapers
npm install @nestjs/bull bull
npm install ioredis
```

```typescript
// backend/src/modules/scraper/scraper.module.ts

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScraperService } from './scraper.service';
import { ScraperConfigService } from './scraper-config.service';
import { ScraperProcessor } from './scraper.processor';
import { ScraperController } from './scraper.controller';
import { ScraperUpdateService } from './scraper-update.service';
import { EncryptionModule } from '../../common/encryption/encryption.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scraper',
    }),
    EncryptionModule,
  ],
  controllers: [ScraperController],
  providers: [
    ScraperService,
    ScraperConfigService,
    ScraperProcessor,
    ScraperUpdateService,
  ],
  exports: [ScraperService],
})
export class ScraperModule {}
```

```typescript
// backend/src/modules/scraper/scraper.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { createScraper, CompanyTypes, ScraperOptions } from 'israeli-bank-scrapers';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScraperConfigService } from './scraper-config.service';
import { createHash } from 'crypto';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ScraperConfigService,
  ) {}

  // רשימת כל הבנקים הנתמכים
  getSupportedCompanies() {
    return [
      { id: 'hapoalim', name: 'בנק הפועלים', type: 'bank', fields: ['userCode', 'password'] },
      { id: 'leumi', name: 'בנק לאומי', type: 'bank', fields: ['username', 'password'] },
      { id: 'discount', name: 'בנק דיסקאונט', type: 'bank', fields: ['id', 'password', 'num'] },
      { id: 'mercantile', name: 'בנק מרכנתיל', type: 'bank', fields: ['id', 'password', 'num'] },
      { id: 'mizrahi', name: 'מזרחי טפחות', type: 'bank', fields: ['username', 'password'] },
      { id: 'otsarHahayal', name: 'אוצר החייל', type: 'bank', fields: ['username', 'password'] },
      { id: 'union', name: 'בנק איגוד', type: 'bank', fields: ['username', 'password'] },
      { id: 'beinleumi', name: 'הבינלאומי', type: 'bank', fields: ['username', 'password'] },
      { id: 'massad', name: 'בנק מסד', type: 'bank', fields: ['username', 'password'] },
      { id: 'yahav', name: 'בנק יהב', type: 'bank', fields: ['username', 'password', 'nationalID'] },
      { id: 'isracard', name: 'ישראכרט', type: 'creditCard', fields: ['id', 'card6Digits', 'password'] },
      { id: 'visaCal', name: 'ויזה כאל', type: 'creditCard', fields: ['username', 'password'] },
      { id: 'max', name: 'מקס', type: 'creditCard', fields: ['username', 'password'] },
      { id: 'amex', name: 'אמריקן אקספרס', type: 'creditCard', fields: ['id', 'card6Digits', 'password'] },
      { id: 'behatsdaa', name: 'בהצדעה', type: 'creditCard', fields: ['id', 'password'] },
      { id: 'beyahadBishvilha', name: 'ביחד בשבילך', type: 'creditCard', fields: [] },
      { id: 'oneZero', name: 'OneZero', type: 'bank', fields: ['email', 'password', 'phoneNumber'] },
      { id: 'pagi', name: 'פאגי', type: 'bank', fields: [] },
    ];
  }

  async runScraper(configId: string) {
    const config = await this.configService.getDecryptedConfig(configId);
    
    if (!config) {
      throw new Error('Scraper config not found');
    }

    const startDate = config.lastSyncAt 
      ? new Date(config.lastSyncAt)
      : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const options: ScraperOptions = {
      companyId: config.companyId as CompanyTypes,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      verbose: false,
    };

    try {
      this.logger.log(`Starting scraper for ${config.companyId}`);
      
      const scraper = createScraper(options);
      const result = await scraper.scrape(config.credentials);

      if (!result.success) {
        await this.prisma.scraperConfig.update({
          where: { id: configId },
          data: {
            lastSyncStatus: 'error',
            lastError: result.errorType || 'Unknown error',
          },
        });
        throw new Error(result.errorType || 'Scrape failed');
      }

      // Process results
      let newTransactionsCount = 0;

      for (const account of result.accounts || []) {
        // Find or create account
        const dbAccount = await this.findOrCreateAccount(
          config.userId,
          config.companyId,
          account.accountNumber,
        );

        // Update balance if available
        if (account.balance !== undefined) {
          await this.prisma.account.update({
            where: { id: dbAccount.id },
            data: { balance: account.balance },
          });
        }

        // Process transactions
        const newCount = await this.processTransactions(dbAccount.id, account.txns || []);
        newTransactionsCount += newCount;
      }

      // Update config
      await this.prisma.scraperConfig.update({
        where: { id: configId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastError: null,
        },
      });

      this.logger.log(`Scraper completed: ${newTransactionsCount} new transactions`);
      
      return { success: true, newTransactionsCount };
    } catch (error) {
      this.logger.error(`Scraper error: ${error.message}`);
      
      await this.prisma.scraperConfig.update({
        where: { id: configId },
        data: {
          lastSyncStatus: 'error',
          lastError: error.message,
        },
      });
      
      throw error;
    }
  }

  private async findOrCreateAccount(userId: string, companyId: string, accountNumber: string) {
    const company = this.getSupportedCompanies().find(c => c.id === companyId);
    
    return this.prisma.account.upsert({
      where: {
        userId_institutionId_accountNumber: {
          userId,
          institutionId: companyId,
          accountNumber,
        },
      },
      update: {},
      create: {
        userId,
        institutionId: companyId,
        institutionName: company?.name || companyId,
        accountNumber,
        accountType: company?.type === 'creditCard' ? 'CREDIT_CARD' : 'BANK',
      },
    });
  }

  private async processTransactions(accountId: string, transactions: any[]) {
    let newCount = 0;

    for (const txn of transactions) {
      // Create unique hash for deduplication
      const hashInput = `${txn.date}-${txn.chargedAmount}-${txn.description}`;
      const scraperHash = createHash('sha256').update(hashInput).digest('hex');

      // Check if exists
      const existing = await this.prisma.transaction.findUnique({
        where: { scraperHash },
      });

      if (existing) continue;

      // Create transaction
      await this.prisma.transaction.create({
        data: {
          accountId,
          type: txn.type === 'installments' ? 'INSTALLMENTS' : 'NORMAL',
          status: txn.status === 'pending' ? 'PENDING' : 'COMPLETED',
          date: new Date(txn.date),
          processedDate: txn.processedDate ? new Date(txn.processedDate) : null,
          amount: txn.chargedAmount,
          originalAmount: txn.originalAmount,
          originalCurrency: txn.originalCurrency || 'ILS',
          description: txn.description,
          memo: txn.memo,
          installmentNumber: txn.installments?.number,
          installmentTotal: txn.installments?.total,
          scraperIdentifier: txn.identifier?.toString(),
          scraperHash,
          rawData: txn,
        },
      });

      newCount++;
    }

    return newCount;
  }
}
```

```typescript
// backend/src/modules/scraper/scraper-config.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { CreateScraperConfigDto } from './dto/create-scraper-config.dto';

@Injectable()
export class ScraperConfigService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateScraperConfigDto) {
    // Encrypt credentials
    const encrypted = this.encryption.encrypt(JSON.stringify(dto.credentials));

    return this.prisma.scraperConfig.create({
      data: {
        userId,
        companyId: dto.companyId,
        companyDisplayName: dto.companyDisplayName,
        encryptedCredentials: encrypted.encryptedData,
        credentialsIv: encrypted.iv,
        credentialsAuthTag: encrypted.authTag,
      },
    });
  }

  async getDecryptedConfig(configId: string) {
    const config = await this.prisma.scraperConfig.findUnique({
      where: { id: configId },
    });

    if (!config) return null;

    const credentials = JSON.parse(
      this.encryption.decrypt(
        config.encryptedCredentials,
        config.credentialsIv,
        config.credentialsAuthTag,
      ),
    );

    return {
      ...config,
      credentials,
    };
  }

  async getUserConfigs(userId: string) {
    return this.prisma.scraperConfig.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        companyId: true,
        companyDisplayName: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastError: true,
        syncEnabled: true,
        createdAt: true,
      },
    });
  }
}
```

```typescript
// backend/src/modules/scraper/scraper.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ScraperService } from './scraper.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Processor('scraper')
export class ScraperProcessor {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private scraperService: ScraperService,
    private prisma: PrismaService,
  ) {}

  @Process('sync-account')
  async handleSync(job: Job<{ configId: string }>) {
    this.logger.log(`Processing sync job for config: ${job.data.configId}`);
    
    try {
      const result = await this.scraperService.runScraper(job.data.configId);
      return result;
    } catch (error) {
      this.logger.error(`Sync job failed: ${error.message}`);
      throw error;
    }
  }

  @Process('sync-all-accounts')
  async handleSyncAll(job: Job) {
    this.logger.log('Processing sync-all-accounts job');

    const configs = await this.prisma.scraperConfig.findMany({
      where: { isActive: true, syncEnabled: true },
    });

    const results = [];

    // Run sequentially to avoid memory issues with Puppeteer
    for (const config of configs) {
      try {
        const result = await this.scraperService.runScraper(config.id);
        results.push({ configId: config.id, ...result });
      } catch (error) {
        results.push({ configId: config.id, success: false, error: error.message });
      }
      
      // Small delay between scrapers
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return results;
  }
}
```

```typescript
// backend/src/common/encryption/encryption.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKey || masterKey.length !== 64) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)');
    }
    this.key = Buffer.from(masterKey, 'hex');
  }

  encrypt(plaintext: string): { encryptedData: string; iv: string; authTag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedData: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

#### 2.2 מודול עסקאות (Transactions)

```typescript
// backend/src/modules/transactions/transactions.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface GetTransactionsOptions {
  userId: string;
  accountId?: string;
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async getTransactions(options: GetTransactionsOptions) {
    const {
      userId,
      accountId,
      categoryId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = options;

    const where: Prisma.TransactionWhereInput = {
      account: { userId },
    };

    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              institutionName: true,
              accountNumber: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              nameHe: true,
              icon: true,
              color: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCategory(transactionId: string, categoryId: string, userId: string) {
    // Verify ownership
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: { userId },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
      include: {
        category: true,
      },
    });
  }

  async addNote(transactionId: string, notes: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: { userId },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { notes },
    });
  }

  async toggleExcludeFromCashFlow(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: { userId },
      },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { isExcludedFromCashFlow: !transaction.isExcludedFromCashFlow },
    });
  }

  async createManualTransaction(userId: string, data: any) {
    // Get user's first account or create a manual account
    let account = await this.prisma.account.findFirst({
      where: { userId },
    });

    if (!account) {
      account = await this.prisma.account.create({
        data: {
          userId,
          institutionId: 'manual',
          institutionName: 'ידני',
          accountNumber: 'manual',
          accountType: 'BANK',
        },
      });
    }

    return this.prisma.transaction.create({
      data: {
        accountId: account.id,
        date: new Date(data.date),
        amount: data.amount,
        description: data.description,
        categoryId: data.categoryId,
        notes: data.notes,
        isManual: true,
        createdByUserId: userId,
      },
      include: {
        category: true,
        account: true,
      },
    });
  }
}
```

#### 2.3 מודול קטגוריות

```typescript
// backend/src/modules/categories/categories.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async getUserCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [
          { userId },
          { isSystem: true },
        ],
      },
      orderBy: [
        { isSystem: 'desc' },
        { sortOrder: 'asc' },
        { nameHe: 'asc' },
      ],
    });
  }

  async createCategory(userId: string, data: any) {
    return this.prisma.category.create({
      data: {
        userId,
        name: data.name,
        nameHe: data.nameHe,
        icon: data.icon,
        color: data.color,
        parentId: data.parentId,
        isIncome: data.isIncome || false,
        isFixed: data.isFixed || false,
        isTracked: data.isTracked || true,
        keywords: data.keywords || [],
      },
    });
  }

  async updateCategory(categoryId: string, userId: string, data: any) {
    // Verify ownership (can't edit system categories)
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
        isSystem: false,
      },
    });

    if (!category) {
      throw new Error('Category not found or cannot be edited');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data,
    });
  }

  async deleteCategory(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
        isSystem: false,
      },
    });

    if (!category) {
      throw new Error('Category not found or cannot be deleted');
    }

    // Move transactions to uncategorized
    await this.prisma.transaction.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    });

    return this.prisma.category.delete({
      where: { id: categoryId },
    });
  }
}
```

**משימות Phase 2:**
- [ ] מודול Scraper עם תמיכה בכל 18 הבנקים
- [ ] שירות הצפנה AES-256-GCM
- [ ] BullMQ queue לסנכרון
- [ ] עיבוד עסקאות עם deduplication
- [ ] מודול Transactions עם CRUD
- [ ] מודול Categories
- [ ] API endpoints לחשבונות, עסקאות, קטגוריות
- [ ] Frontend: דף חשבונות עם הוספת חשבון
- [ ] Frontend: דף עסקאות עם טבלה ופילטרים
- [ ] Frontend: עריכת קטגוריה של עסקה

---

### Phase 3: Intelligence (שבוע 5-6)

#### 3.1 מודול OLLAMA

```typescript
// backend/src/modules/ollama/ollama.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import axios from 'axios';

interface OllamaConfig {
  enabled: boolean;
  url: string;
  model: string;
  timeout: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async getConfig(userId?: string): Promise<OllamaConfig | null> {
    // Priority: UserSettings > SystemSettings > ENV
    
    if (userId) {
      const userSettings = await this.prisma.userSettings.findUnique({
        where: { userId },
      });

      if (userSettings?.ollamaEnabled !== null) {
        if (!userSettings.ollamaEnabled) return null;
        
        return {
          enabled: true,
          url: userSettings.ollamaUrl || '',
          model: userSettings.ollamaModel || 'mistral',
          timeout: 30000,
        };
      }
    }

    const systemSettings = await this.prisma.systemSettings.findFirst();
    
    if (systemSettings?.ollamaEnabled) {
      return {
        enabled: true,
        url: systemSettings.ollamaUrl || '',
        model: systemSettings.ollamaModel,
        timeout: systemSettings.ollamaTimeout,
      };
    }

    // Fallback to ENV
    const enabled = this.configService.get('OLLAMA_ENABLED') === 'true';
    if (!enabled) return null;

    return {
      enabled: true,
      url: this.configService.get('OLLAMA_BASE_URL') || '',
      model: this.configService.get('OLLAMA_MODEL') || 'mistral',
      timeout: parseInt(this.configService.get('OLLAMA_TIMEOUT') || '30000'),
    };
  }

  async isAvailable(userId?: string): Promise<boolean> {
    const config = await this.getConfig(userId);
    if (!config || !config.url) return false;

    try {
      const response = await axios.get(`${config.url}/api/tags`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async testConnection(url: string, model?: string): Promise<{
    success: boolean;
    latencyMs?: number;
    availableModels?: string[];
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await axios.get(`${url}/api/tags`, { timeout: 10000 });
      const latencyMs = Date.now() - startTime;
      
      const models = response.data?.models?.map((m: any) => m.name) || [];

      // If model specified, check if it exists
      if (model && !models.includes(model)) {
        return {
          success: false,
          latencyMs,
          availableModels: models,
          error: `מודל ${model} לא נמצא בשרת`,
        };
      }

      return {
        success: true,
        latencyMs,
        availableModels: models,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'לא ניתן להתחבר לשרת',
      };
    }
  }

  async categorizeTransaction(
    transaction: { description: string; amount: number; date: Date },
    categories: { id: string; nameHe: string }[],
    userId?: string,
  ): Promise<{ categoryId: string; confidence: number; method: 'ollama' | 'rules' | 'fallback' }> {
    const config = await this.getConfig(userId);

    // If OLLAMA not available, use fallback rules
    if (!config || !config.url) {
      return this.categorizeWithRules(transaction, categories);
    }

    try {
      const categoryList = categories
        .map((c) => `- ${c.id}: ${c.nameHe}`)
        .join('\n');

      const prompt = `אתה מערכת לסיווג עסקאות פיננסיות.
קיבלת עסקה עם התיאור הבא: "${transaction.description}"
הסכום: ${transaction.amount} ש"ח
התאריך: ${transaction.date.toLocaleDateString('he-IL')}

הקטגוריות האפשריות הן:
${categoryList}

החזר תשובה בפורמט JSON בלבד, ללא טקסט נוסף:
{"categoryId": "xxx", "confidence": 0.XX}

בחר את הקטגוריה המתאימה ביותר.`;

      const response = await axios.post(
        `${config.url}/api/generate`,
        {
          model: config.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
          },
        },
        { timeout: config.timeout },
      );

      const text = response.data?.response || '';
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.categorizeWithRules(transaction, categories);
      }

      const result = JSON.parse(jsonMatch[0]);
      
      if (result.confidence < 0.5) {
        return this.categorizeWithRules(transaction, categories);
      }

      return {
        categoryId: result.categoryId,
        confidence: result.confidence,
        method: 'ollama',
      };
    } catch (error) {
      this.logger.warn(`OLLAMA categorization failed: ${error.message}`);
      return this.categorizeWithRules(transaction, categories);
    }
  }

  private categorizeWithRules(
    transaction: { description: string; amount: number },
    categories: { id: string; nameHe: string }[],
  ): { categoryId: string; confidence: number; method: 'rules' | 'fallback' } {
    const description = transaction.description.toLowerCase();

    // Keywords mapping
    const keywordMap: Record<string, string[]> = {
      groceries: ['רמי לוי', 'שופרסל', 'מגה', 'ויקטורי', 'יוחננוף', 'אושר עד', 'סופר', 'מרקט', 'am:pm'],
      restaurants: ['מסעדה', 'קפה', 'פיצה', 'סושי', 'מקדונלד', 'בורגר', 'ארומה', 'קופיקס', 'cafe', 'rest'],
      fuel: ['דלק', 'סונול', 'פז', 'דור אלון', 'ten', 'yellow', 'delek'],
      pharmacy: ['סופר פארם', 'בית מרקחת', 'פארם', 'be', 'super-pharm'],
      subscriptions: ['נטפליקס', 'ספוטיפי', 'אפל', 'גוגל', 'אמזון', 'hbo', 'disney', 'netflix', 'spotify'],
      transportation: ['רכבת', 'אגד', 'דן', 'מטרופולין', 'רב קו', 'moovit'],
      health: ['קופת חולים', 'מכבי', 'כללית', 'מאוחדת', 'לאומית'],
      atm_withdrawal: ['משיכת מזומן', 'כספומט', 'atm'],
      bank_fees: ['עמלה', 'דמי ניהול', 'ריבית'],
    };

    for (const [categoryName, keywords] of Object.entries(keywordMap)) {
      for (const keyword of keywords) {
        if (description.includes(keyword.toLowerCase())) {
          const category = categories.find((c) => c.id === categoryName);
          if (category) {
            return {
              categoryId: category.id,
              confidence: 0.7,
              method: 'rules',
            };
          }
        }
      }
    }

    // Fallback to uncategorized
    const uncategorized = categories.find((c) => c.id === 'uncategorized');
    return {
      categoryId: uncategorized?.id || categories[0]?.id || '',
      confidence: 0.3,
      method: 'fallback',
    };
  }
}
```

#### 3.2 מודול Dashboard

```typescript
// backend/src/modules/dashboard/dashboard.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getCashFlowSummary(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Get all transactions for the month
    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        isExcludedFromCashFlow: false,
      },
      include: {
        category: true,
      },
    });

    // Calculate totals
    let incomeTotal = 0;
    let incomeFixed = 0;
    let incomeVariable = 0;
    
    let expensesTotal = 0;
    let expensesFixed = 0;
    let expensesTracked = 0;
    let expensesVariable = 0;

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      
      if (amount > 0) {
        // Income
        incomeTotal += amount;
        if (txn.category?.isFixed) {
          incomeFixed += amount;
        } else {
          incomeVariable += amount;
        }
      } else {
        // Expense (negative amount)
        const absAmount = Math.abs(amount);
        expensesTotal += absAmount;
        
        if (txn.category?.isFixed) {
          expensesFixed += absAmount;
        } else if (txn.category?.isTracked) {
          expensesTracked += absAmount;
        } else {
          expensesVariable += absAmount;
        }
      }
    }

    const remaining = incomeTotal - expensesTotal;

    // Get previous month for comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSummary = await this.getPreviousMonthSummary(userId, prevMonth, prevYear);

    return {
      month,
      year,
      income: {
        total: incomeTotal,
        fixed: incomeFixed,
        variable: incomeVariable,
      },
      expenses: {
        total: expensesTotal,
        fixed: expensesFixed,
        tracked: expensesTracked,
        variable: expensesVariable,
      },
      remaining,
      comparedToLastMonth: {
        income: prevSummary.income > 0 
          ? ((incomeTotal - prevSummary.income) / prevSummary.income) * 100 
          : 0,
        expenses: prevSummary.expenses > 0 
          ? ((expensesTotal - prevSummary.expenses) / prevSummary.expenses) * 100 
          : 0,
        remaining: prevSummary.remaining !== 0 
          ? ((remaining - prevSummary.remaining) / Math.abs(prevSummary.remaining)) * 100 
          : 0,
      },
    };
  }

  private async getPreviousMonthSummary(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await this.prisma.transaction.aggregate({
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        isExcludedFromCashFlow: false,
      },
      _sum: { amount: true },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        isExcludedFromCashFlow: false,
      },
    });

    let income = 0;
    let expenses = 0;

    for (const txn of transactions) {
      const amount = Number(txn.amount);
      if (amount > 0) {
        income += amount;
      } else {
        expenses += Math.abs(amount);
      }
    }

    return {
      income,
      expenses,
      remaining: income - expenses,
    };
  }

  async getWeeklyBreakdown(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 }, // Only expenses
        isExcludedFromCashFlow: false,
      },
      orderBy: { date: 'asc' },
    });

    // Group by week
    const weeks: { weekNumber: number; startDate: Date; endDate: Date; total: number }[] = [];
    
    let currentWeekStart = new Date(startDate);
    // Adjust to Sunday
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());

    while (currentWeekStart <= endDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekTotal = transactions
        .filter((t) => {
          const txnDate = new Date(t.date);
          return txnDate >= currentWeekStart && txnDate <= weekEnd;
        })
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      weeks.push({
        weekNumber: weeks.length + 1,
        startDate: new Date(currentWeekStart),
        endDate: weekEnd > endDate ? endDate : weekEnd,
        total: weekTotal,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return weeks;
  }

  async getCategoryBreakdown(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const result = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
      },
      _sum: { amount: true },
      _count: true,
    });

    // Get category details
    const categories = await this.prisma.category.findMany({
      where: {
        OR: [{ userId }, { isSystem: true }],
      },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const breakdown = result
      .map((r) => {
        const category = categoryMap.get(r.categoryId || '');
        return {
          categoryId: r.categoryId,
          categoryName: category?.nameHe || 'לא מסווג',
          icon: category?.icon || '❓',
          color: category?.color || '#gray',
          total: Math.abs(Number(r._sum.amount) || 0),
          count: r._count,
        };
      })
      .sort((a, b) => b.total - a.total);

    const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);

    return breakdown.map((b) => ({
      ...b,
      percentage: grandTotal > 0 ? (b.total / grandTotal) * 100 : 0,
    }));
  }
}
```

**משימות Phase 3:**
- [ ] מודול OLLAMA עם קטגוריזציה חכמה
- [ ] Fallback לכללים סטטיים
- [ ] בדיקת חיבור OLLAMA
- [ ] מודול Dashboard עם חישובים
- [ ] API endpoints ל-dashboard
- [ ] Frontend: דשבורד עם "כמה נשאר להוציא"
- [ ] Frontend: גרפים (Recharts)
- [ ] Frontend: הגדרות OLLAMA

---

### Phase 4: Advanced (שבוע 7-8)

#### 4.1 מודול תקציבים

```typescript
// backend/src/modules/budgets/budgets.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async getBudget(userId: string, month: number, year: number) {
    const budget = await this.prisma.budget.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!budget) return null;

    // Calculate actual spending for each category
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const spending = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        account: { userId },
        date: { gte: startDate, lte: endDate },
        amount: { lt: 0 },
        isExcludedFromCashFlow: false,
      },
      _sum: { amount: true },
    });

    const spendingMap = new Map(
      spending.map((s) => [s.categoryId, Math.abs(Number(s._sum.amount) || 0)]),
    );

    return {
      ...budget,
      categories: budget.categories.map((bc) => ({
        ...bc,
        spent: spendingMap.get(bc.categoryId) || 0,
        remaining: Number(bc.amount) - (spendingMap.get(bc.categoryId) || 0),
        percentage: (spendingMap.get(bc.categoryId) || 0) / Number(bc.amount) * 100,
      })),
    };
  }

  async setBudget(userId: string, month: number, year: number, categories: { categoryId: string; amount: number }[]) {
    // Upsert budget
    const budget = await this.prisma.budget.upsert({
      where: {
        userId_month_year: { userId, month, year },
      },
      update: {},
      create: { userId, month, year },
    });

    // Delete existing budget categories
    await this.prisma.budgetCategory.deleteMany({
      where: { budgetId: budget.id },
    });

    // Create new budget categories
    await this.prisma.budgetCategory.createMany({
      data: categories.map((c) => ({
        budgetId: budget.id,
        categoryId: c.categoryId,
        amount: c.amount,
      })),
    });

    return this.getBudget(userId, month, year);
  }
}
```

#### 4.2 מודול OCR

```typescript
// backend/src/modules/ocr/ocr.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { OllamaService } from '../ollama/ollama.service';

interface ReceiptData {
  amount: number | null;
  date: Date | null;
  merchant: string | null;
  confidence: number;
  rawText: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(private ollamaService: OllamaService) {}

  async processReceipt(imageBuffer: Buffer, userId?: string): Promise<ReceiptData> {
    // Run Tesseract OCR
    const worker = await createWorker('heb+eng');
    
    try {
      const { data: { text, confidence } } = await worker.recognize(imageBuffer);
      await worker.terminate();

      this.logger.log(`OCR completed with confidence: ${confidence}%`);

      // Try to extract data with regex first
      const regexResult = this.extractWithRegex(text);

      // If regex didn't find everything, try OLLAMA
      if ((!regexResult.amount || !regexResult.merchant) && await this.ollamaService.isAvailable(userId)) {
        const ollamaResult = await this.extractWithOllama(text, userId);
        return {
          amount: regexResult.amount || ollamaResult.amount,
          date: regexResult.date || ollamaResult.date,
          merchant: regexResult.merchant || ollamaResult.merchant,
          confidence: confidence / 100,
          rawText: text,
        };
      }

      return {
        ...regexResult,
        confidence: confidence / 100,
        rawText: text,
      };
    } catch (error) {
      this.logger.error(`OCR failed: ${error.message}`);
      throw error;
    }
  }

  private extractWithRegex(text: string): Partial<ReceiptData> {
    // Extract amount (₪, שח, NIS patterns)
    const amountPatterns = [
      /סה"כ[:\s]*([0-9,]+\.?[0-9]*)/,
      /סכום[:\s]*([0-9,]+\.?[0-9]*)/,
      /total[:\s]*([0-9,]+\.?[0-9]*)/i,
      /₪\s*([0-9,]+\.?[0-9]*)/,
      /([0-9,]+\.?[0-9]*)\s*₪/,
      /([0-9,]+\.?[0-9]*)\s*ש"?ח/,
    ];

    let amount: number | null = null;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        amount = parseFloat(match[1].replace(',', ''));
        break;
      }
    }

    // Extract date
    const datePatterns = [
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
    ];

    let date: Date | null = null;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, day, month, year] = match;
        const fullYear = year.length === 2 ? `20${year}` : year;
        date = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day));
        break;
      }
    }

    // Extract merchant (first line usually)
    const lines = text.split('\n').filter(l => l.trim());
    const merchant = lines[0]?.trim() || null;

    return { amount, date, merchant };
  }

  private async extractWithOllama(text: string, userId?: string): Promise<Partial<ReceiptData>> {
    try {
      const config = await this.ollamaService.getConfig(userId);
      if (!config) return {};

      const prompt = `חלץ את המידע הבא מקבלה זו:
${text}

החזר JSON בלבד:
{"amount": 123.45, "merchant": "שם העסק", "date": "2024-01-15"}
אם לא מצאת ערך, החזר null.`;

      const response = await fetch(`${config.url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt,
          stream: false,
        }),
      });

      const data = await response.json();
      const jsonMatch = data.response?.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          amount: result.amount,
          merchant: result.merchant,
          date: result.date ? new Date(result.date) : null,
        };
      }
    } catch (error) {
      this.logger.warn(`OLLAMA extraction failed: ${error.message}`);
    }

    return {};
  }
}
```

#### 4.3 מודול Webhooks

```typescript
// backend/src/modules/webhooks/webhooks.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createHmac } from 'crypto';
import axios from 'axios';

export enum WebhookEvent {
  TRANSACTION_NEW = 'transaction.new',
  TRANSACTION_LARGE_EXPENSE = 'transaction.large_expense',
  TRANSACTION_MANUAL_CREATED = 'transaction.manual_created',
  BUDGET_WARNING = 'budget.warning',
  BUDGET_EXCEEDED = 'budget.exceeded',
  SYNC_COMPLETED = 'sync.completed',
  SYNC_FAILED = 'sync.failed',
  ACCOUNT_LOW_BALANCE = 'account.low_balance',
  SUMMARY_WEEKLY = 'summary.weekly',
  SUMMARY_MONTHLY = 'summary.monthly',
  USER_CREATED = 'user.created',
  SCRAPER_UPDATE_AVAILABLE = 'system.scraper_update_available',
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async emit(userId: string, event: WebhookEvent, data: any) {
    // Get user's webhook configs
    const configs = await this.prisma.webhookConfig.findMany({
      where: {
        userId,
        isActive: true,
        events: { has: event },
      },
    });

    // Also check for n8n integration
    const userSettings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (userSettings?.n8nEnabled && userSettings?.n8nWebhookUrl) {
      configs.push({
        id: 'n8n',
        userId,
        name: 'n8n',
        url: userSettings.n8nWebhookUrl,
        secret: userSettings.n8nWebhookSecret || '',
        events: Object.values(WebhookEvent),
        isActive: true,
        lastTriggeredAt: null,
        lastStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    for (const config of configs) {
      await this.sendWebhook(config, event, data);
    }
  }

  private async sendWebhook(config: any, event: WebhookEvent, data: any) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      meta: {
        userId: config.userId,
        webhookId: config.id,
        appVersion: '1.0.0',
      },
    };

    const signature = this.signPayload(payload, config.secret);

    try {
      await axios.post(config.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        timeout: 10000,
      });

      await this.prisma.webhookConfig.update({
        where: { id: config.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: 'success',
        },
      });

      this.logger.log(`Webhook sent successfully: ${event} to ${config.name}`);
    } catch (error) {
      this.logger.error(`Webhook failed: ${error.message}`);

      if (config.id !== 'n8n') {
        await this.prisma.webhookConfig.update({
          where: { id: config.id },
          data: {
            lastTriggeredAt: new Date(),
            lastStatus: `error: ${error.message}`,
          },
        });
      }
    }
  }

  private signPayload(payload: any, secret: string): string {
    return createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
```

**משימות Phase 4:**
- [ ] מודול Budgets עם הגדרה ומעקב
- [ ] מודול OCR עם Tesseract
- [ ] אינטגרציית OLLAMA ל-OCR
- [ ] מודול Webhooks
- [ ] שליחת אירועים ל-n8n
- [ ] Frontend: דף תקציבים
- [ ] Frontend: סריקת קבלות
- [ ] Frontend: הגדרות n8n
- [ ] Frontend: ניהול webhooks

---

### Phase 5: Polish (שבוע 9-10)

#### 5.1 PWA Configuration

ראה את הקוד המפורט למעלה עבור:
- `manifest.json`
- Service Worker עם Workbox
- Push Notifications

#### 5.2 Docker & Deployment

ראה את ה-`docker-compose.yml` וה-`nginx/default.conf` למעלה.

**משימות Phase 5:**
- [ ] PWA: manifest.json
- [ ] PWA: Service Worker
- [ ] PWA: Push Notifications
- [ ] PWA: Offline support
- [ ] Export to Excel
- [ ] Household sharing
- [ ] Admin panel
- [ ] Scraper update check
- [ ] Docker Compose final
- [ ] nginx configuration
- [ ] Documentation
- [ ] Testing

---

## בקשות נוספות

אנא ודא:
1. שימוש ב-TypeScript strict mode
2. Error handling מקיף עם custom exceptions
3. Logging עם winston או pino
4. תיעוד API עם Swagger
5. Unit tests לפונקציות קריטיות (encryption, scraper processing)
6. E2E tests לflows עיקריים

התחל לבנות את האפליקציה לפי המפרט הזה. התחל מ-Phase 1 והתקדם בהדרגה. שאל שאלות אם משהו לא ברור.
