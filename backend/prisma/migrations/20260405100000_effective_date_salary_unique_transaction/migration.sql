-- UserSettings columns (salaryStartDay/salaryEndDay) are created with UserSettings in 20260430200000_phase4.

-- AlterTable Transaction
ALTER TABLE "Transaction" ADD COLUMN     "effectiveDate" TIMESTAMP(3);

UPDATE "Transaction" SET "effectiveDate" = "date" WHERE "effectiveDate" IS NULL;

-- Dedupe exact (accountId, date, amount, description) before unique; keep oldest createdAt
DELETE FROM "Transaction" a
WHERE a.id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "accountId", "date", "amount", "description"
        ORDER BY "createdAt" ASC
      ) AS rn
    FROM "Transaction"
  ) sub
  WHERE rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "unique_transaction" ON "Transaction"("accountId", "date", "amount", "description");
