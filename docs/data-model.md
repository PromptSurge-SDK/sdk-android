# PromptSurge Data Model

> **Status:** Updated through M19. All models live in production at `api.promptsurge.me`.

The Postgres database is defined via Prisma schema at `apps/api/prisma/schema.prisma`.
Migrations live in `apps/api/prisma/migrations/` and are applied automatically on Fly.io deploy via `release_command: npx prisma migrate deploy`.

---

## Models

| Model | Added in | Purpose |
|-------|----------|---------|
| `Developer` | M4 | Admin panel user account |
| `OAuthAccount` | M11 | Linked Google / GitHub OAuth provider per developer |
| `Organization` | M12 | Team workspace (one org can own multiple apps) |
| `OrganizationMember` | M12 | Developer ↔ org membership with `owner`/`member` role |
| `OrganizationInvite` | M12 | Token-based invite emails (7-day expiry) |
| `Session` | M4 | Developer auth session tokens |
| `App` | M2 | Developer's registered app (owns all per-app data) |
| `ApiKey` | M4 | Per-app SDK keys with `revokedAt` grace-period revocation |
| `Event` | M2 | Raw analytics event from the SDK |
| `PromptText` | M3 | Localized pre-prompt copy (`draft`/`active`/`discarded`) |
| `Keyword` | M6 | Positive or negative keyword for LLM prompt generation |
| `BannedKeyword` | M17 | Global ban list (legal/compliance terms, seeded at migration) |
| `KeywordAuditLog` | M17 | Per-app log of keyword add/remove actions with actor email |
| `AppDialogTheme` | M18 | Per-app dialog visual theme (preset + optional color overrides) |
| `LlmProviderConfig` | M6 | Developer's BYOLLM provider and encrypted API key |
| `LlmUsageLog` | M6 | Per-LLM-call telemetry (tokens, cost, success) |
| `Theme` | M6.5 | Praise theme extracted from pasted app-store reviews |
| `ReviewAnalysisRun` | M6.5 | Audit log for each theme-extraction LLM call |

---

## Enums

| Enum | Values |
|------|--------|
| `PromptStatus` | `draft` · `active` · `discarded` |
| `KeywordType` | `positive` · `negative` |
| `KeywordAction` | `added` · `removed` |
| `LlmProviderType` | `openai_compatible` · `anthropic` · `gemini` |
| `ThemeStatus` | `pending` · `accepted` · `discarded` |
| `AnalysisRunStatus` | `pending` · `completed` · `failed` · `cached` |
| `OrgRole` | `owner` · `member` |
| `SubscriptionTier` | `indie` · `startup` · `growth` · `enterprise` |
| `SubscriptionStatus` | `active` · `past_due` · `cancelled` · `paused` |

---

## App billing fields

Billing state lives directly on the `App` model (no separate `Subscription` table — Lemon Squeezy is the source of truth):

| Field | Type | Notes |
|-------|------|-------|
| `subscriptionTier` | `SubscriptionTier` | Default `indie` |
| `subscriptionStatus` | `SubscriptionStatus` | Default `active` |
| `lsSubscriptionId` | `String?` | Lemon Squeezy subscription ID — `null` = never paid |
| `lsCustomerId` | `String?` | Lemon Squeezy customer ID |
| `billingPeriodStart` | `DateTime?` | Current billing period start |
| `billingPeriodEnd` | `DateTime?` | Current billing period end (used for cancellation date display) |

Impression counting is done at query time (`Event` count within the current billing period). There is no separate counter column — this avoids drift.

---

## AppDialogTheme

One optional row per app. `presetId` selects from four server-side presets (`default`, `midnight`, `ocean`, `sunset`). The four color fields are **overrides** — `null` means "use the preset's value". The API's `resolveTheme()` function merges overrides with preset defaults before returning.

The SDK receives the fully-resolved theme object in the `/v1/prompts` response and caches it in `SharedPreferences` as JSON under key `dialog_theme`.

---

## BannedKeyword

Global table seeded in migration `20260516000000_m17_keywords`. Not per-app. Current seed list (12 terms):

`5 star`, `5-star`, `five star`, `five stars`, `rate us`, `leave a review`, `positive review`, `good review`, `google play`, `play store`, `app store`, `rate our app`

---

## Event

Key fields:

| Field | Notes |
|-------|-------|
| `eventId` | Client-generated UUID v4 — server deduplicates via `ON CONFLICT DO NOTHING` |
| `holdout` | `true` = device is in the holdout group (never shown the pre-prompt) |
| `resolvedLocale` | Locale the server actually served (after fallback), may differ from `locale` |
| `payload` | JSON blob — carries `resolvedLocale` for `pre_prompt_shown` events |

Event types (defined in SDK `EventTypes`):

| Type | Fired when |
|------|-----------|
| `first_open` | First launch ever (once per install) |
| `pre_prompt_shown` | Pre-prompt dialog appeared |
| `pre_prompt_confirmed` | User tapped the confirm CTA |
| `pre_prompt_dismissed` | User tapped dismiss |
| `review_requested` | Native review dialog was requested |

---

## Key indexes

Performance-critical compound indexes on `Event`:

- `(appId, eventType, timestamp)` — metrics aggregations
- `(appId, deviceId, timestamp)` — cooldown lookups
- `(appId, resolvedLocale, timestamp)` — geo breakdown
- `(appId, holdout, timestamp)` — holdout group split
