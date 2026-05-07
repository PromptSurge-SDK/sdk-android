-- M11: App soft-delete
-- Adds deletedAt to App for the soft-delete / discarded-section feature.
-- null = active; non-null = soft-deleted (awaiting restore or permanent removal).

ALTER TABLE "App" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Index for fast dashboard queries that filter active vs deleted apps
CREATE INDEX "App_deletedAt_idx" ON "App" ("deletedAt");
