# PromptSurge — Session Handoff

> **Last updated:** 2026-05-08  
> **Current status:** M19 complete, fully deployed. M20 (marketing site) is next.

This document is the fastest path to full context for a new Claude Code session. Read it before touching any code.

---

## What is PromptSurge?

An Android SDK + SaaS backend that shows a polished, Apple-policy-safe pre-prompt dialog before requesting an in-app review via the Google Play Review API. The pre-prompt is server-driven (text, locale, visual theme), analytics-tracked, and optimized via LLM-generated copy from developer-supplied keywords.

**The rule that must never break:** the pre-prompt dialog is purely informational — both buttons lead to the same outcome (requesting or skipping the native review). There is NO sentiment gate ("Are you enjoying the app?") that only shows the native prompt to happy users. This is hard-coded into the design for Apple App Store rule 5.6.1 compatibility.

---

## Live services

| Service | URL | Platform |
|---------|-----|----------|
| API | https://api.promptsurge.me | Fly.io (`promptsurge` app, region `iad`) |
| Admin panel | https://admin.promptsurge.me | Vercel |
| Marketing site | https://promptsurge.me | Vercel (static, minimal — not yet the real M20 site) |
| Database | Supabase (PostgreSQL) | Managed |

Deployments are automatic on `git push origin master`:
- Fly.io: `release_command: npx prisma migrate deploy` runs migrations before traffic switches.
- Vercel: watches `apps/admin/` and `apps/marketing/` for changes.

---

## Completed milestones (M0–M19)

| M | What was built |
|---|----------------|
| M0 | Repo skeleton, pnpm workspaces, CI, Docker compose |
| M1 | Android SDK: `PromptSurge.kt` public API, `PrePromptDialogFragment`, `PromptSurge.requestReviewIfAppropriate()` |
| M2 | `POST /v1/events` ingestion, `Event` model, SDK event queue + flush |
| M3 | Server-driven prompt text, locale fallback chain, `PromptTextRepository` with 6-level cache |
| M4 | Developer auth (email/password), `Session`, `ApiKey`, `Developer` models |
| M5 | Next.js 14 admin panel: login, dashboard, app CRUD, key rotation |
| M6 | BYOLLM keyword-to-prompt generation, `LlmProviderConfig`, `LlmUsageLog`, encrypted API keys (libsodium) |
| M6.5 | Review-driven theme amplification: paste reviews → LLM extracts themes → inject into prompt generation |
| M7 | Metrics dashboard: impressions, TTR%, RPI, holdout comparison, geo breakdown, 2-col chart widgets |
| M9 | Lemon Squeezy billing: 3 paid tiers (Startup/Growth/Enterprise), webhooks, checkout, portal, invoices |
| M10 | Impression metering: per-period counting, `GET /admin/apps/:id/subscription`, enforcement gate |
| M11 | Google + GitHub OAuth login, `OAuthAccount` model, link/unlink from profile page |
| M12 | Team/org system: `Organization`, `OrganizationMember`, `OrganizationInvite`, email invite flow |
| M13 | Developer profile: first/last name, avatar, password change, account delete (7-day grace) |
| M14 | Holdout group: 10% of devices never see the pre-prompt; holdout metrics in Overview + Metrics pages |
| M15 | Billing portal link + invoice history table in admin |
| M16 | App soft-delete (7-day grace), key rotation with grace period, `app_deleted` SDK response |
| M17 | Keywords v2: bulk comma-add, 1-2 word validation, ban list (12 seeded terms), audit log, CSV import/export |
| M18 | Dialog visual themes: 4 presets + custom color overrides, live preview in admin, SDK applies in `onStart()` |
| M19 | Sub-lapse warning banners: `past_due`, `cancelled`, downgrade-to-indie, ≥80% impression limit |

---

## Architecture overview

```
Android app
  └── PromptSurge.kt          Public SDK entry point
        ├── PromptTextRepository.kt   Fetch + cache dialog copy/theme
        ├── PrePromptDialogFragment   Shows dialog, fires events
        └── Telemetry.kt              Event queue → POST /v1/events

Admin browser
  └── Next.js 14 (Vercel)
        ├── RSC pages fetch from /admin/* (server-side, token from cookie)
        └── Client components proxy via /api/* routes → API

Fastify API (Fly.io)
  ├── /v1/events          SDK event ingestion
  ├── /v1/prompts         SDK prompt/theme fetch
  ├── /admin/*            Authenticated admin routes
  └── /webhooks/lemonsqueezy   Billing webhook handler

PostgreSQL (Supabase)
  └── Prisma ORM
```

### Admin proxy pattern

Next.js client components cannot call the Fastify API directly (no session token available in the browser). Instead:

1. `/apps/admin/src/app/api/*/route.ts` — thin Next.js route handlers
2. They read the session cookie server-side, inject it as `Authorization: Bearer <token>`
3. Forward to `https://api.promptsurge.me/admin/...`

---

## Key files to know

### API (`apps/api/src/routes/`)

| File | What it does |
|------|-------------|
| `adminAuth.ts` | Signup, login, logout, OAuth, profile |
| `adminApps.ts` | App CRUD, key rotation, soft-delete |
| `adminMetrics.ts` | Analytics aggregations for Overview + Metrics pages |
| `adminKeywords.ts` | Keywords CRUD, ban-list, audit log, CSV import/export |
| `adminAppearance.ts` | Dialog theme GET/PUT, `DIALOG_PRESETS`, `resolveTheme()` |
| `adminSubscription.ts` | Subscription state, checkout, portal, invoices |
| `adminOrg.ts` | Team invite, accept, member management |
| `prompts.ts` | `/v1/prompts` — SDK fetch endpoint (includes resolved theme) |
| `events.ts` | `/v1/events` — SDK event ingestion |
| `webhooks.ts` | Lemon Squeezy webhook handler |

### Admin (`apps/admin/src/`)

| File | What it does |
|------|-------------|
| `components/AppSidebar.tsx` | Left nav, app switcher, subscription footer with warning state |
| `components/SubscriptionBanners.tsx` | M19 warning banners (past_due, cancelled, limit) |
| `lib/api.ts` | All typed API client functions + interfaces |
| `app/(dashboard)/apps/[id]/layout.tsx` | Fetches subscription → passes to sidebar |
| `app/(dashboard)/apps/[id]/page.tsx` | Overview page: banners + charts + API key |
| `app/(dashboard)/apps/[id]/metrics/` | Full metrics dashboard with charts + geo table |
| `app/(dashboard)/apps/[id]/keywords/KeywordsClient.tsx` | Keyword management UI |
| `app/(dashboard)/apps/[id]/appearance/AppearanceClient.tsx` | Visual theme editor |
| `app/(dashboard)/apps/[id]/events/EventsClient.tsx` | Live event log (2-min auto-refresh) |

### Android SDK (`packages/sdk-android/sdk-android/src/main/java/com/promptsurge/sdk/`)

| File | What it does |
|------|-------------|
| `PromptSurge.kt` | Public entry point: `initialize()`, `requestReviewIfAppropriate()`, `optOut()` |
| `PrePromptDialogFragment.kt` | Dialog UI; `onStart()` applies server-driven theme colors |
| `internal/PromptTextRepository.kt` | 6-level cache (memory → disk → live fetch → stale → any-locale → defaults) |
| `internal/PromptDefaults.kt` | Bundled English fallback copy + `DialogTheme` data class |
| `internal/Telemetry.kt` | Event queue with retry, flush on resume |

---

## Subscription / billing rules

- **Indie (free):** 500 impressions/month. Default for all new apps.
- **Startup:** 10,000 impressions/month.
- **Growth:** 100,000 impressions/month.
- **Enterprise:** Unlimited.
- Impression limit enforcement: the API checks `Event` count within the current `billingPeriodStart`–`billingPeriodEnd` on every `/v1/events` and `/v1/prompts` call. Over-limit apps get a `402` response; the SDK suppresses the dialog silently.
- `lsSubscriptionId = null` → never paid (indie by default).
- `lsSubscriptionId != null` + `tier = indie` + `status = active` → was on a paid plan, subscription expired/cancelled and was downgraded.

---

## Open items / known gaps

| Item | Notes |
|------|-------|
| Header image upload | Scaffolded as "Coming soon" in the Appearance page (`AppearanceClient.tsx`). Needs S3 + CDN wiring. |
| Per-keyword TTR attribution | Events don't carry `promptId` or `keywordId`. Requires SDK changes to add prompt ID to event payload, then join on server. |
| Email notifications for sub-lapse | User wants this in the future. No email provider configured yet. |
| Ban-list expansion | Current 12 terms are a starter set. Needs legal/compliance review to grow. |
| Marketing site (M20) | Minimal placeholder exists at `apps/marketing/`. Full landing page not yet built. |
| SDK publish (M21) | AAR builds locally. Maven Central / JitPack publish pipeline not set up. |
| AWS KMS for LLM keys | Production should use KMS instead of `SODIUM_PRIVATE_KEY` env var. Noted as M8.5 TODO in `deployment.md`. |

---

## What's next (M20–M22)

### M20 — Marketing landing page
Build the real `promptsurge.me` landing page inside `apps/marketing/`. Stack: Next.js 14, static export, Tailwind. Should include: hero, feature highlights, pricing table (3 paid tiers + free), social proof placeholder, CTA to admin signup.

### M21 — Android SDK publish
Set up Maven Central (or JitPack as a simpler alternative) publish pipeline for `sdk-android`. Add `maven-publish` Gradle plugin, configure signing, automate release on git tag. Update `docs/api-contract.md` with installation instructions.

### M22 — Public launch
- Marketing site live with real copy and pricing
- SDK published and installable via Gradle
- `SODIUM_PRIVATE_KEY` → AWS KMS
- Email notification provider for sub-lapse (SES or Postmark)
- Announce on relevant communities

---

## How to start a new session

1. Read this file (`docs/handoff.md`).
2. Read `docs/conventions.md` — the hard rules that must not be violated.
3. Run `git log --oneline -20` to see recent work.
4. Tell Claude which milestone you're tackling.

For schema changes: always run `npx prisma generate` in `apps/api/` after editing `schema.prisma`, otherwise TypeScript will fail to compile.

For API deploys: `flyctl deploy --remote-only` from the repo root. Migrations run automatically.

For admin deploys: push to `master` — Vercel auto-deploys on merge.
