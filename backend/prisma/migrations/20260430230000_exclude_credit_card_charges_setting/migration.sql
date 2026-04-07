-- Auto-exclude aggregate credit-card charges from bank feed (avoid double-count with card scrapers)
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "excludeCreditCardChargesFromBudget" BOOLEAN NOT NULL DEFAULT true;
