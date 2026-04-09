-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "showInactiveAccounts" BOOLEAN NOT NULL DEFAULT false;
