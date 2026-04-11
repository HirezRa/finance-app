-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "dismissedAlertIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
