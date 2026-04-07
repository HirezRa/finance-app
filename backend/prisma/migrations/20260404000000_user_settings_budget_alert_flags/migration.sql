-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "budgetWarningEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "budgetExceededEnabled" BOOLEAN NOT NULL DEFAULT true;
