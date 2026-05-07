-- M7: Metrics aggregation views
-- Uses existing indexes on Event(appId, eventType, timestamp) and (appId, resolvedLocale, timestamp)

-- Daily rollup: pivot event types into columns per (appId, date, resolvedLocale, appVersion)
CREATE OR REPLACE VIEW event_daily_rollup AS
SELECT
  "appId",
  DATE_TRUNC('day', "timestamp") AS "date",
  COALESCE("resolvedLocale", locale) AS "resolvedLocale",
  "appVersion",
  COUNT(CASE WHEN "eventType" = 'first_open'              THEN 1 END) AS "firstOpen",
  COUNT(CASE WHEN "eventType" = 'initialize'               THEN 1 END) AS "initialize",
  COUNT(CASE WHEN "eventType" = 'pre_prompt_shown'        THEN 1 END) AS "prePromptShown",
  COUNT(CASE WHEN "eventType" = 'pre_prompt_confirmed'    THEN 1 END) AS "prePromptConfirmed",
  COUNT(CASE WHEN "eventType" = 'pre_prompt_dismissed'    THEN 1 END) AS "prePromptDismissed",
  COUNT(CASE WHEN "eventType" = 'native_prompt_requested' THEN 1 END) AS "nativePromptRequested",
  COUNT(*) AS "totalEvents"
FROM "Event"
GROUP BY 1, 2, 3, 4;

-- Tap-through daily: derived from rollup
CREATE OR REPLACE VIEW tap_through_daily AS
SELECT
  "appId",
  "date",
  "resolvedLocale",
  "appVersion",
  "prePromptShown",
  "prePromptConfirmed",
  "prePromptDismissed",
  CASE WHEN "prePromptShown" > 0
    THEN ROUND(("prePromptConfirmed"::numeric / "prePromptShown"::numeric) * 100, 2)
    ELSE 0
  END AS "tapThroughRate"
FROM event_daily_rollup;
