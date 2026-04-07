-- Custom display order for budget lines + timestamps
ALTER TABLE "BudgetCategory" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BudgetCategory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "BudgetCategory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Remove duplicates (keep lexicographically smallest id per budget+category)
DELETE FROM "BudgetCategory" a
USING "BudgetCategory" b
WHERE a."budgetId" = b."budgetId"
  AND a."categoryId" = b."categoryId"
  AND a.id > b.id;

DO $$
BEGIN
  ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_budgetId_categoryId_key" UNIQUE ("budgetId", "categoryId");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "BudgetCategory_budgetId_sortOrder_idx" ON "BudgetCategory"("budgetId", "sortOrder");
