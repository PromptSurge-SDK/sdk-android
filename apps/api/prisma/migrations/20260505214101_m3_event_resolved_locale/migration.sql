-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "resolvedLocale" TEXT;

-- Backfill from payload.resolvedLocale for any rows ingested before this column existed.
UPDATE "Event"
SET "resolvedLocale" = payload->>'resolvedLocale'
WHERE "resolvedLocale" IS NULL
  AND payload ? 'resolvedLocale'
  AND jsonb_typeof(payload->'resolvedLocale') = 'string';

-- CreateIndex
CREATE INDEX "Event_appId_resolvedLocale_timestamp_idx" ON "Event"("appId", "resolvedLocale", "timestamp");
