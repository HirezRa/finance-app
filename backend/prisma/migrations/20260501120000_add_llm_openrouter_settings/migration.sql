-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "llmProvider" TEXT NOT NULL DEFAULT 'ollama',
ADD COLUMN     "openrouterModel" TEXT,
ADD COLUMN     "openrouterApiKeyEncrypted" TEXT,
ADD COLUMN     "openrouterApiKeyIv" TEXT,
ADD COLUMN     "openrouterApiKeyTag" TEXT;
