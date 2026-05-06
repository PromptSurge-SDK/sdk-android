# PromptSurge Data Model

> **Status:** Updated through M4 — `App`, `Event`, `PromptText`, `Developer`, `Session`, and `ApiKey` models live. M3 added `Event.resolvedLocale`. M4 added auth models and restructured `App` (added `developerId` FK; moved `apiKey` value into the new `ApiKey` table).

---

## Overview

The Postgres database is defined via Prisma schema at `apps/api/prisma/schema.prisma`.

---

## Models

| Model | Added in | Purpose |
|-------|----------|---------|
| `App` | M2 | Represents a developer's registered app |
| `Event` | M2 | Raw analytics event from the SDK |
| `Developer` | M4 | Developer (admin panel user) account |
| `ApiKey` | M4 | Per-app API keys with revocation support |
| `Session` | M4 | Developer auth sessions |
| `PromptText` | M3 | Localized pre-prompt copy |
| `Keyword` | M6 | Positive/negative keywords for LLM prompt generation |
| `LlmProviderConfig` | M6 | Developer's bring-your-own LLM provider configuration |
| `LlmUsageLog` | M6 | Per-app LLM call telemetry (tokens, cost, success) |
| `Theme` | M6.5 | Extracted praise themes from review analysis |
| `ReviewAnalysisRun` | M6.5 | Audit log for each theme-extraction LLM call |
| `JobRun` | M6.5 | BullMQ job execution history |
