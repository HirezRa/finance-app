-- AlterTable Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable Category
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "parentId" TEXT,
    "isIncome" BOOLEAN NOT NULL DEFAULT false,
    "isFixed" BOOLEAN NOT NULL DEFAULT false,
    "isTracked" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "keywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- AlterTable Transaction
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isExcludedFromCashFlow" BOOLEAN NOT NULL DEFAULT false;

-- ForeignKeys
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_userId_fkey";
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_categoryId_fkey";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "Category_userId_idx" ON "Category"("userId");
CREATE INDEX IF NOT EXISTS "Category_name_idx" ON "Category"("name");
CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- System category for uncategorized transactions (idempotent)
INSERT INTO "Category" (
  "id",
  "userId",
  "name",
  "nameHe",
  "isSystem",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "isIncome",
  "isFixed",
  "isTracked"
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'uncategorized',
  'לא מסווג',
  true,
  999,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  false,
  false,
  false
) ON CONFLICT ("id") DO NOTHING;
