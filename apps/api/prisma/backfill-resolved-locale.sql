UPDATE "Event"
SET "resolvedLocale" = payload->>'resolvedLocale'
WHERE "resolvedLocale" IS NULL
  AND payload ? 'resolvedLocale'
  AND jsonb_typeof(payload->'resolvedLocale') = 'string';
