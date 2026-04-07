-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecretIv" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorSecretTag" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryCodesIv" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recoveryCodesTag" TEXT;

-- CreateTable Budget
CREATE TABLE IF NOT EXISTS "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Budget_userId_month_year_key" ON "Budget"("userId", "month", "year");
CREATE INDEX IF NOT EXISTS "Budget_userId_idx" ON "Budget"("userId");

ALTER TABLE "Budget" DROP CONSTRAINT IF EXISTS "Budget_userId_fkey";
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable BudgetCategory
CREATE TABLE IF NOT EXISTS "BudgetCategory" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BudgetCategory_budgetId_categoryId_key" UNIQUE ("budgetId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "BudgetCategory_budgetId_idx" ON "BudgetCategory"("budgetId");
CREATE INDEX IF NOT EXISTS "BudgetCategory_categoryId_idx" ON "BudgetCategory"("categoryId");
CREATE INDEX IF NOT EXISTS "BudgetCategory_budgetId_sortOrder_idx" ON "BudgetCategory"("budgetId", "sortOrder");

ALTER TABLE "BudgetCategory" DROP CONSTRAINT IF EXISTS "BudgetCategory_budgetId_fkey";
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BudgetCategory" DROP CONSTRAINT IF EXISTS "BudgetCategory_categoryId_fkey";
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable UserSettings
CREATE TABLE IF NOT EXISTS "UserSettings" (
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'he',
    "dateFormat" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',
    "largeExpenseThreshold" DECIMAL(18,2),
    "budgetWarningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "budgetExceededEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ollamaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ollamaUrl" TEXT,
    "ollamaModel" TEXT,
    "n8nEnabled" BOOLEAN NOT NULL DEFAULT false,
    "n8nWebhookUrl" TEXT,
    "n8nWebhookSecret" TEXT,
    "salaryStartDay" INTEGER NOT NULL DEFAULT 25,
    "salaryEndDay" INTEGER NOT NULL DEFAULT 31,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserSettings" DROP CONSTRAINT IF EXISTS "UserSettings_userId_fkey";
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
