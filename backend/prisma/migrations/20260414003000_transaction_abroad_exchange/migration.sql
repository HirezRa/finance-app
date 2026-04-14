-- Foreign transaction: implied ILS per 1 unit of original currency
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(12,6);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isAbroad" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Transaction"
SET "isAbroad" = true
WHERE COALESCE(UPPER(TRIM("originalCurrency")), 'ILS') != 'ILS';

UPDATE "Transaction"
SET "isAbroad" = false,
    "exchangeRate" = NULL,
    "originalAmount" = NULL
WHERE COALESCE(UPPER(TRIM("originalCurrency")), 'ILS') = 'ILS';

UPDATE "Transaction"
SET "exchangeRate" = ABS("amount" / "originalAmount")
WHERE "isAbroad" = true
  AND "originalAmount" IS NOT NULL
  AND "originalAmount" != 0;

CREATE INDEX IF NOT EXISTS "Transaction_isAbroad_idx" ON "Transaction"("isAbroad");
CREATE INDEX IF NOT EXISTS "Transaction_originalCurrency_idx" ON "Transaction"("originalCurrency");
