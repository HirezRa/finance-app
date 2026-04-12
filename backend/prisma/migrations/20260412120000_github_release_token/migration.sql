-- Encrypted GitHub PAT for release checks (per user, AES-256-GCM via app encryption key)
ALTER TABLE "UserSettings" ADD COLUMN "githubReleaseTokenEncrypted" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "githubReleaseTokenIv" TEXT;
ALTER TABLE "UserSettings" ADD COLUMN "githubReleaseTokenTag" TEXT;
