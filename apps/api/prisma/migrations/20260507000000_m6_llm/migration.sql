-- M6: LLM prompt optimization
-- Adds: PromptStatus/KeywordType/LlmProviderType enums, Keyword, LlmProviderConfig, LlmUsageLog tables.
-- Alters: PromptText gets imageUrl, status, sourceKeywords, generatedByLlm, updatedAt;
--         the old @@unique([appId, locale]) is dropped to allow multiple prompts per locale.

-- Enums
CREATE TYPE "PromptStatus" AS ENUM ('draft', 'active', 'discarded');
CREATE TYPE "KeywordType" AS ENUM ('positive', 'negative');
CREATE TYPE "LlmProviderType" AS ENUM ('openai_compatible', 'anthropic', 'gemini');

-- PromptText: new columns
ALTER TABLE "PromptText"
  ADD COLUMN "imageUrl"       TEXT,
  ADD COLUMN "status"         "PromptStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "sourceKeywords" TEXT[]         NOT NULL DEFAULT '{}',
  ADD COLUMN "generatedByLlm" BOOLEAN        NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop old unique constraint (multiple prompts per app+locale are now allowed)
DROP INDEX IF EXISTS "PromptText_appId_locale_key";

-- New composite index for efficient active-prompt lookup
CREATE INDEX "PromptText_appId_locale_status_idx" ON "PromptText"("appId", "locale", "status");

-- Keyword
CREATE TABLE "Keyword" (
  "id"        TEXT        NOT NULL,
  "appId"     TEXT        NOT NULL,
  "text"      TEXT        NOT NULL,
  "type"      "KeywordType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Keyword_appId_idx" ON "Keyword"("appId");
ALTER TABLE "Keyword"
  ADD CONSTRAINT "Keyword_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LlmProviderConfig
CREATE TABLE "LlmProviderConfig" (
  "id"              TEXT             NOT NULL,
  "appId"           TEXT             NOT NULL,
  "providerType"    "LlmProviderType" NOT NULL,
  "modelName"       TEXT             NOT NULL,
  "baseUrl"         TEXT,
  "encryptedApiKey" BYTEA            NOT NULL,
  "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmProviderConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LlmProviderConfig_appId_key" ON "LlmProviderConfig"("appId");
ALTER TABLE "LlmProviderConfig"
  ADD CONSTRAINT "LlmProviderConfig_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LlmUsageLog
CREATE TABLE "LlmUsageLog" (
  "id"           TEXT             NOT NULL,
  "appId"        TEXT             NOT NULL,
  "providerType" "LlmProviderType" NOT NULL,
  "modelName"    TEXT             NOT NULL,
  "inputTokens"  INTEGER          NOT NULL,
  "outputTokens" INTEGER          NOT NULL,
  "success"      BOOLEAN          NOT NULL,
  "errorMessage" TEXT,
  "purpose"      TEXT             NOT NULL DEFAULT 'prompt_generation',
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmUsageLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LlmUsageLog_appId_createdAt_idx" ON "LlmUsageLog"("appId", "createdAt");
ALTER TABLE "LlmUsageLog"
  ADD CONSTRAINT "LlmUsageLog_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
