-- M6.5: Review-driven theme amplification
-- Adds ThemeStatus + AnalysisRunStatus enums, Theme + ReviewAnalysisRun models,
-- and appStoreUrl / playStoreUrl columns on App.

-- New enums
CREATE TYPE "ThemeStatus" AS ENUM ('pending', 'accepted', 'discarded');
CREATE TYPE "AnalysisRunStatus" AS ENUM ('pending', 'completed', 'failed', 'cached');

-- App: store URL fields (unused at launch, M9 wires them)
ALTER TABLE "App" ADD COLUMN "appStoreUrl" TEXT;
ALTER TABLE "App" ADD COLUMN "playStoreUrl" TEXT;

-- Theme table
CREATE TABLE "Theme" (
  "id"             TEXT NOT NULL,
  "appId"          TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "frequency"      INTEGER NOT NULL,
  "examplePhrases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"         "ThemeStatus" NOT NULL DEFAULT 'pending',
  "sourceHash"     TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Theme"
  ADD CONSTRAINT "Theme_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Theme_appId_sourceHash_status_idx" ON "Theme"("appId", "sourceHash", "status");

-- ReviewAnalysisRun table
CREATE TABLE "ReviewAnalysisRun" (
  "id"            TEXT NOT NULL,
  "appId"         TEXT NOT NULL,
  "sourceHash"    TEXT NOT NULL,
  "reviewCount"   INTEGER NOT NULL,
  "filteredCount" INTEGER NOT NULL,
  "inputTokens"   INTEGER NOT NULL DEFAULT 0,
  "outputTokens"  INTEGER NOT NULL DEFAULT 0,
  "costUsd"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "llmUsageLogId" TEXT,
  "status"        "AnalysisRunStatus" NOT NULL DEFAULT 'pending',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewAnalysisRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReviewAnalysisRun"
  ADD CONSTRAINT "ReviewAnalysisRun_appId_fkey"
  FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewAnalysisRun"
  ADD CONSTRAINT "ReviewAnalysisRun_llmUsageLogId_fkey"
  FOREIGN KEY ("llmUsageLogId") REFERENCES "LlmUsageLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReviewAnalysisRun_appId_sourceHash_createdAt_idx"
  ON "ReviewAnalysisRun"("appId", "sourceHash", "createdAt");
