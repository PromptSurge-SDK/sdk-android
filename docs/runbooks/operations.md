# Operations Runbook

> **Status:** Updated through M2.

---

## Local development setup

See the root [README](../../README.md) for the full cold-start procedure.

---

## M2 — End-to-end event ingestion

### One-time setup

1. **Start Postgres** (Docker Desktop must be running):
   ```bash
   cd promptsurge && docker compose up -d db
   ```
   Verify: `docker compose ps` should show `db` healthy on `localhost:5432`.

2. **Apply schema and seed**:
   ```bash
   cd apps/api
   pnpm db:migrate     # creates the `App` and `Event` tables on first run
   pnpm db:seed        # inserts the App row with apiKey=test-api-key-m1
   ```

3. **Start the API**:
   ```bash
   cd apps/api && pnpm dev
   ```
   Should print `Server listening on http://0.0.0.0:3000`. `curl http://localhost:3000/health` returns `{"status":"ok",...}`.

4. **Start the admin panel**:
   ```bash
   cd apps/admin && pnpm dev
   ```
   `/events` at `http://localhost:3001/events` (Next dev port; adjust if changed).

### Emulator networking — `10.0.2.2:3000`

The Android emulator routes its own loopback to the device's localhost; the **host machine's** localhost is reachable via the magic IP `10.0.2.2`. The SDK's `BuildConfig.PROMPTSURGE_API_URL` defaults to `http://10.0.2.2:3000` for this reason.

Physical device or non-emulator: override the URL by editing `packages/sdk-android/sdk-android/build.gradle.kts` and changing the `buildConfigField` for `PROMPTSURGE_API_URL` to your machine's LAN IP, e.g. `"http://192.168.1.42:3000"`.

If events don't arrive, check in this order:
1. Device → host: `adb shell curl -v http://10.0.2.2:3000/health` (works on most emulator images).
2. Host firewall: temporarily allow inbound 3000.
3. SDK logs: `adb logcat -s PromptSurge:* PromptSurgeEventBus:*` — every flush attempt logs success/failure.

### Verifying ingestion in <30s

By design the SDK flushes every 30 seconds OR when the app is backgrounded. To verify quickly:

1. Tap the "Trigger Pre-Prompt" button in the sample app.
2. Press the home button (sends app to background → triggers `onStop` → immediate flush).
3. Refresh `/events` in the admin panel — `pre_prompt_shown` (and possibly `pre_prompt_confirmed` + `native_prompt_requested`) should appear within a second.

DB-side check:
```sql
SELECT "eventType", "timestamp", "deviceId" FROM "Event" ORDER BY "timestamp" DESC LIMIT 10;
```

### Verbose SDK logging

The SDK uses Android's `Log` with these tags:

| Tag | Use |
|-----|-----|
| `PromptSurge` | Main entry-point lifecycle (initialize, requestReview decisions). |
| `PromptSurgeEventBus` | Every flush attempt, retry, drop. Most useful for ingestion debugging. |
| `PromptSurgePrePrompt` | Dialog lifecycle. |

Filter only PromptSurge logs:
```bash
adb logcat -s PromptSurge:* PromptSurgeEventBus:* PromptSurgePrePrompt:*
```

For client-side trace of what's being POSTed, set OkHttp's logging interceptor in `EventBus.create` (currently disabled to avoid logging API keys in release).

---

## Sections (to be filled in M3+)

- Seeding a developer account (M5)
- Revoking a leaked API key (M4)
- Inspecting LLM usage logs (M6)
- Triggering the soft-delete cleanup job (M8.5)
