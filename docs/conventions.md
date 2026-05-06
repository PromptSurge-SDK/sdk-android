# PromptSurge Conventions

Cross-cutting rules every Claude Code session starts from.

---

## Apple 5.6.1 / sentiment-gating

**No sentiment-gating in pre-prompts, ever.** The pre-prompt must not ask users a sentiment question ("Are you enjoying X?") and then only show the native rating prompt to users who answer positively. Both dialog buttons lead to the same outcome. This is a hard constraint for Apple App Store policy compliance and must hold even when building Android-only code.

---

## Backend URL

`BuildConfig.PROMPTSURGE_API_URL`; default `http://10.0.2.2:3000` for the Android emulator (emulator → host loopback). Production: `https://api.promptsurge.com`.

---

## Authentication headers

| Caller | Header |
|--------|--------|
| SDK | `X-PromptSurge-Key: <api-key>` |
| Admin panel | `Authorization: Bearer <session-token>` |

---

## Event idempotency

Every event has a client-generated `eventId` (UUID v4). The server skips duplicates silently — `INSERT ... ON CONFLICT (eventId) DO NOTHING`.

---

## PII rules

- `deviceId` = `SHA-256(ANDROID_ID + applicationContext.packageName)` — never store raw `ANDROID_ID`.
- Server logs the request IP but does not persist it beyond 30 days.

---

## Localization fallback chain

`app + exact locale` → `app + language-only` → `global + exact locale` → `global + language-only` → `global + en`

---

## Rate limits (end-user prompt cooldowns)

- 90 days after the pre-prompt is **shown**
- 7 days after the user taps **"Not now"** (dismiss without confirming)

---

## Rate limits (SDK ingestion)

`POST /v1/events` is capped at **100 req/min per API key** (token bucket). Excess returns `429` with `Retry-After`. The SDK must honor `Retry-After` and pause its flush schedule accordingly.

---

## Rate limits (admin auth)

`/admin/signup` and `/admin/login` are limited to **10 req/min per IP**.

---

## Bring-Your-Own LLM

PromptSurge never pays for developer LLM costs. Every developer configures their own provider and key in the admin panel. Default selection in the UI picker is **DeepSeek `deepseek-v4-flash`** (cheapest mainstream option, free starter credits at signup).

---

## LLM key encryption

In **production and staging**: the libsodium private key is held in AWS KMS (`LLM_KEY_KMS_ARN` + `LLM_KEY_ENCRYPTED_BLOB`). The key is decrypted into memory at startup and never persisted to disk.

In **development** only (`NODE_ENV=development`): env-var fallback is permitted, but the process logs a loud `*** DEVELOPMENT KEY MODE — NEVER USE IN PRODUCTION ***` warning at startup.

Stored developer API keys are never logged and never returned in API responses — display as `***` + last 4 characters.

---

## `first_open` event

Fired exactly once per device-install via a `SharedPreferences` flag. Used as the install-count proxy for `reviews-per-install` metrics (M7), modeled after Firebase's same-named event.

---

## SDK opt-out

`PromptSurge.optOut()` halts all event emission, drains the queue without flushing, and sets a persistent flag. `PromptSurge.optIn()` reverses it. Every event-emitting code path checks the flag first.

---

## Image uploads

Server-side MIME sniffing via `file-type` (not client-declared header). Re-encoded via `sharp` (strips EXIF as a side effect). Filenames are `${uuidv4()}.${ext}` — never derived from user input. Served from `cdn.<domain>`.

---

## Soft-delete window

Developer account deletion has a **7-day grace period** before hard delete. A daily cron job sweeps records where `deletedAt < now - 7d`.

---

## Pasted review text

Review text is processed in-memory and **never persisted**. Only `sourceHash` (sha256 of normalized text), extracted themes, and aggregate counts are stored. Verified by DB inspection in M6.5 acceptance tests.

---

## Theme cache TTL

7 days. Re-pasting identical content (same `sourceHash`) within the window returns cached themes with no LLM call.

---

## Theme analysis rate limit

10 analysis runs/day per app (cache hits are exempt). Independent of the `POST /v1/events` ingestion limit.
