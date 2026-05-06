# PromptSurge API Contract

Single source of truth for the SDK ↔ API wire format.

> **Status:** M0 stub — sections will be filled as milestones are completed.

---

## Authentication

| Header | Used by | Description |
|--------|---------|-------------|
| `X-PromptSurge-Key` | SDK endpoints (`/v1/*`) | Per-app API key issued by admin panel. Format: `ps_live_<32 base64url chars>`. Resolves to an `App` row; revoked keys (past `revokedAt`) return 401. Keys with a future `revokedAt` are within the 7-day rotation grace window and remain valid. |
| `Authorization: Bearer <token>` | Admin endpoints (`/admin/*`) | Opaque developer session token (32 random bytes, base64url). 30-day expiry with sliding-window refresh: any access with <7 days remaining bumps the expiry to now+30d. |

### Auth model (M4)

- **Developers** sign up with email + password (Argon2id hashed).
- A **Session** row is created on signup/login; the bearer token maps 1:1 to a row.
- **Apps** belong to one developer. **ApiKey** rows belong to an App; an app can have multiple active keys + grace-windowed revoked keys.
- **Cross-tenant isolation:** every read endpoint scopes by `request.developer.id` (admin) or `request.app.id` (SDK). One developer cannot read another's events, prompts, or apps.
- **Rate limits:** `/admin/signup` and `/admin/login` are capped at 10/min/IP via `@fastify/rate-limit`.

---

## SDK Endpoints

### `GET /health`

Returns server health and version.

```json
{ "status": "ok", "version": "0.0.1" }
```

---

### `POST /v1/events` _(M2)_

Ingest a batch of analytics events from the SDK.

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `X-PromptSurge-Key` | yes | Per-app API key. Returns `401` if missing or unknown. |
| `Content-Type` | yes | `application/json` |

**Request body**

```json
{
  "events": [
    {
      "eventType": "pre_prompt_shown",
      "eventId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "timestamp": "2026-05-05T12:00:00.000Z",
      "sessionId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
      "deviceId": "<sha256 hex>",
      "appVersion": "1.2.3",
      "sdkVersion": "0.0.1",
      "locale": "en-US",
      "platform": "android",
      "payload": {}
    }
  ]
}
```

`events` is a non-empty array of up to **500** events. The full schema is the discriminated union exported as `EventSchema` from `@promptsurge/shared-types`.

**Event types** (M2): `first_open`, `initialize`, `pre_prompt_shown`, `pre_prompt_confirmed`, `pre_prompt_dismissed`, `native_prompt_requested`.

**Payload shapes:**
- `first_open`: `{ installSource?: string }`
- `pre_prompt_shown` / `pre_prompt_confirmed` / `pre_prompt_dismissed` / `native_prompt_requested`: `{ resolvedLocale?: string }` (M3+) — the locale actually rendered to the user, after the server's fallback chain. May differ from the top-level `locale` field, which is the device locale.
- Other types: `{}`.

**Responses**

| Status | Body | Meaning |
|--------|------|---------|
| `202` | `{ "accepted": n, "skipped": m }` | Batch ingested. `skipped` counts events whose `eventId` was already stored (idempotent retries). |
| `400` | `{ "error": "invalid_batch", "issues": [...] }` | Body failed schema validation. |
| `401` | `{ "error": "missing_api_key" \| "invalid_api_key" }` | Header absent or app not found. |

**Idempotency**

`eventId` is unique per event globally. Re-sending the same `eventId` is silently ignored — the SDK can safely retry batches without producing duplicates.

---

### `GET /v1/prompts` _(M3)_

Resolve the localized pre-prompt copy for a given locale.

**Headers**

| Header | Required |
|--------|----------|
| `X-PromptSurge-Key` | yes |

**Query**

| Param | Required | Description |
|-------|----------|-------------|
| `locale` | yes | BCP47 tag, e.g. `en`, `de`, `de-DE`, `fr-CA`. Falls back as below. |

**Resolution chain** (first hit wins)

1. App-specific exact locale (e.g. `de-DE`)
2. App-specific language-only (`de`)
3. Global exact locale
4. Global language-only
5. Global `en`

App-specific rows arrive once developers customize copy via the admin panel (M5+). For M3, only globals are seeded.

**Responses**

| Status | Body |
|--------|------|
| `200` | `{ "locale": "de", "title": "...", "body": "...", "ctaConfirm": "...", "ctaDismiss": "..." }` |
| `401` | `{ "error": "missing_api_key" \| "invalid_api_key" }` |
| `404` | `{ "error": "no_prompt_text" }` (only if even the global `en` row is missing — should never happen in production) |

The `locale` field in the response reflects what the server actually served (after fallback), not what the client requested.

---

## Admin Endpoints

All endpoints below require `Authorization: Bearer <session-token>` unless marked otherwise.

### `POST /admin/signup` _(public; rate-limited 10/min/IP)_

Body: `{ email: string, password: string }` (password ≥ 8 chars).

Returns `201 { token, expiresAt, developer: { id, email } }`. Conflicts with `409 { error: "email_in_use" }`.

### `POST /admin/login` _(public; rate-limited 10/min/IP)_

Body: `{ email, password }`. Returns `200 { token, expiresAt, developer }` or `401 { error: "invalid_credentials" }` (same response for unknown email and wrong password — no user enumeration).

### `POST /admin/logout`

Invalidates the bearer token. Returns `204`.

### `GET /admin/me`

Returns `{ id, email, createdAt }` for the authenticated developer.

### `POST /admin/apps`

Body: `{ name }`.

Returns `201 { app: { id, name, createdAt }, apiKey: { id, key, createdAt } }`. **The plaintext `key` is only ever returned here** — there is no list-keys endpoint by design.

### `GET /admin/apps`

Returns `{ apps: [{ id, name, createdAt, keyCount, eventCount }] }`, scoped to the developer.

### `POST /admin/apps/:appId/keys/rotate`

Marks every active key for revocation in 7 days, issues a fresh key, and returns `{ apiKey, revokedCount, gracePeriodDays }`. The SDK can keep authenticating with the old key during the grace window — gives developers time to ship an app update.

### `GET /admin/events`

Optional `?appId=` filter and `?page=N` pagination (50/page, capped at 1000 total). Returns events for apps the authenticated developer owns. Used by the admin panel `/events` page.
