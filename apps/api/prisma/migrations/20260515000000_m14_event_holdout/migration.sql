-- M14: holdout baseline group — tag events with which experiment group they belong to.
-- Default false = treatment (show pre-prompt). True = holdout (skip pre-prompt, measure natural rate).
-- Historical events default to false (treatment), which is correct: they were all treatment events.
ALTER TABLE "Event" ADD COLUMN "holdout" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Event_appId_holdout_timestamp_idx" ON "Event"("appId", "holdout", "timestamp");
