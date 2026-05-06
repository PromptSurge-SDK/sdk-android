-- M4: Developer accounts, sessions, and per-app API keys.
--
-- This migration also restructures the existing App table (drops App.apiKey, adds App.developerId)
-- and migrates the existing seeded api key into a row in the new ApiKey table so events ingested
-- with the old hardcoded test key keep working until rotated.

BEGIN;

-- 1. Create Developer table
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Developer_email_key" ON "Developer"("email");

-- 2. Create Session table
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_developerId_idx" ON "Session"("developerId");

-- 3. Create ApiKey table
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");
CREATE INDEX "ApiKey_appId_idx" ON "ApiKey"("appId");
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- 4. Seed default developer (password = "password123"). Deterministic id so subsequent runs
--    of the seed-dev script know where to attach.
--    Hash precomputed at design time via @node-rs/argon2.hash('password123').
INSERT INTO "Developer" ("id", "email", "passwordHash", "createdAt")
VALUES (
    'seed_dev_default',
    'dev@promptsurge.test',
    '$argon2id$v=19$m=19456,t=2,p=1$qmuyc2AkknlZYRh8+5875Q$aBB+Y3oiNdzqTUW/u5u7Ip/CPfUv8gcWYXzPAKR725k',
    CURRENT_TIMESTAMP
);

-- 5. Add App.developerId nullable so we can backfill, then promote to NOT NULL.
ALTER TABLE "App" ADD COLUMN "developerId" TEXT;
UPDATE "App" SET "developerId" = 'seed_dev_default' WHERE "developerId" IS NULL;
ALTER TABLE "App" ALTER COLUMN "developerId" SET NOT NULL;

-- 6. Add FK + index for App.developerId
ALTER TABLE "App"
    ADD CONSTRAINT "App_developerId_fkey"
    FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE;
CREATE INDEX "App_developerId_idx" ON "App"("developerId");

-- 7. Migrate existing App.apiKey values into ApiKey rows so the old hardcoded SDK key
--    keeps working until manually revoked.
INSERT INTO "ApiKey" ("id", "appId", "key", "createdAt")
SELECT 'legacy_' || "id", "id", "apiKey", "createdAt"
FROM "App"
WHERE "apiKey" IS NOT NULL;

-- 8. Add ApiKey FK constraint (deferred until after the rows are inserted to avoid ordering issues).
ALTER TABLE "ApiKey"
    ADD CONSTRAINT "ApiKey_appId_fkey"
    FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE;

-- 9. Drop the old App.apiKey column + its unique index.
DROP INDEX IF EXISTS "App_apiKey_idx";
ALTER TABLE "App" DROP CONSTRAINT IF EXISTS "App_apiKey_key";
ALTER TABLE "App" DROP COLUMN "apiKey";

-- 10. Add Session FK constraint.
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_developerId_fkey"
    FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE;

COMMIT;
