-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "includePendingInBudget" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserSettings" ADD COLUMN "includePendingInDashboard" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "bankIdentifier" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pendingMatchHash" TEXT;

ALTER TABLE "Transaction" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

-- CreateIndex
CREATE INDEX "Transaction_accountId_status_idx" ON "Transaction"("accountId", "status");

-- CreateIndex
CREATE INDEX "Transaction_pendingMatchHash_idx" ON "Transaction"("pendingMatchHash");
