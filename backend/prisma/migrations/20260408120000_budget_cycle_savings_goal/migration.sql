-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "budgetCycleStartDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserSettings" ADD COLUMN "monthlySavingsGoal" DECIMAL(12,2) NOT NULL DEFAULT 0;
