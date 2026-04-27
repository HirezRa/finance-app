-- Idempotent LLM columns on UserSettings (PostgreSQL 11+ IF NOT EXISTS)
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "llmProvider" TEXT NOT NULL DEFAULT 'ollama';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "openrouterModel" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "openrouterApiKeyEncrypted" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "openrouterApiKeyIv" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "openrouterApiKeyTag" TEXT;
