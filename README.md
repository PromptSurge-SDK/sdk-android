# PromptSurge SDK

Android SDK + backend that adds a polished, Apple-safe pre-prompt dialog before the Google Play In-App Review flow — increasing tap-through rates without violating store policies.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker | latest | https://docker.com |
| JDK | 17 | [Adoptium](https://adoptium.net) |
| Android Studio | Iguana+ | https://developer.android.com/studio |

---

## Quick start (under 10 minutes)

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd promptsurge

# 2. Install all JS/TS dependencies
pnpm install

# 3. Start Postgres
docker compose up -d db

# 4. Configure the API environment
cp apps/api/.env.example apps/api/.env
# (defaults already point at the docker Postgres — no changes needed for local dev)

# 5. Generate the Prisma client
pnpm --filter api db:generate

# 6. Run the API
pnpm dev:api
# → http://localhost:3000/health should return {"status":"ok","version":"0.0.1"}

# 7. (Optional) Run the admin panel
pnpm dev:admin
# → http://localhost:4000
```

---

## Running each app

### API (`apps/api`)

```bash
pnpm --filter api dev        # dev server with hot-reload
pnpm --filter api build      # compile to dist/
pnpm --filter api start      # run compiled output
```

Environment variables — copy `.env.example` to `.env` and edit:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://promptsurge:promptsurge@localhost:5432/promptsurge` | Postgres connection string |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Environment |

### Admin panel (`apps/admin`)

```bash
pnpm --filter admin dev      # dev server (Next.js)
pnpm --filter admin build    # production build
```

Copy `apps/admin/.env.local.example` to `apps/admin/.env.local` and set `NEXT_PUBLIC_API_URL`.

### Shared types (`packages/shared-types`)

```bash
pnpm --filter @promptsurge/shared-types build
```

---

## Android modules

Both Android modules live under `packages/sdk-android/` and share a single Gradle project.

### Open in Android Studio

1. Open Android Studio
2. **File → Open** → select `packages/sdk-android/`
3. Let Gradle sync complete (~2 min first run)
4. Select the `sample-app-android` run configuration and hit Run

### Command-line builds

```bash
cd packages/sdk-android

# Run unit tests for the SDK
./gradlew :sdk-android:test

# Build the SDK release AAR
./gradlew :sdk-android:assembleRelease
# Output: sdk-android/build/outputs/aar/sdk-android-release.aar

# Build the sample app debug APK
./gradlew :sample-app-android:assembleDebug
# Output: ../sample-app-android/app/build/outputs/apk/debug/app-debug.apk

# Run all tasks
./gradlew build
```

> The emulator's host machine is reachable at `10.0.2.2`. The API dev server on port 3000 is therefore at `http://10.0.2.2:3000` from within the emulator.

---

## Running tests

```bash
# All TS/JS tests
pnpm -r test

# API tests only
pnpm --filter api test

# Android unit tests only
cd packages/sdk-android && ./gradlew :sdk-android:test
```

---

## Linting & typechecking

```bash
pnpm -r lint          # ESLint across all TS packages
pnpm -r typecheck     # tsc --noEmit across all TS packages
```

---

## Database

```bash
docker compose up -d db          # start Postgres in the background
docker compose down              # stop
docker compose down -v           # stop + delete data volume

pnpm --filter api db:migrate     # run pending Prisma migrations
pnpm --filter api db:generate    # regenerate Prisma client after schema change
pnpm --filter api db:studio      # open Prisma Studio (visual DB browser)
```

---

## Repository layout

```
promptsurge/
├── apps/
│   ├── admin/                 Next.js 14 admin panel
│   │   └── src/
│   │       ├── app/(dashboard)/apps/[id]/
│   │       │   ├── page.tsx             Overview + subscription banners
│   │       │   ├── metrics/             Analytics charts + geo breakdown
│   │       │   ├── keywords/            Keyword management + audit log
│   │       │   ├── prompts/             Prompt text editor
│   │       │   ├── themes/              Review-driven themes (M6.5)
│   │       │   ├── appearance/          Dialog visual theme editor (M18)
│   │       │   ├── events/              Raw event log
│   │       │   ├── llm-config/          BYOLLM provider setup
│   │       │   ├── llm-usage/           LLM call log
│   │       │   └── settings/            Billing, team
│   │       └── components/
│   │           ├── AppSidebar.tsx       Nav + subscription footer
│   │           └── SubscriptionBanners.tsx  M19 warning banners
│   └── api/                   Fastify API + Prisma
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── src/routes/
│           ├── adminAuth.ts
│           ├── adminApps.ts
│           ├── adminMetrics.ts
│           ├── adminKeywords.ts
│           ├── adminAppearance.ts
│           ├── adminSubscription.ts
│           ├── adminOrg.ts
│           ├── events.ts
│           ├── prompts.ts
│           └── webhooks.ts
├── packages/
│   ├── sdk-android/           Kotlin SDK — Gradle root
│   │   └── sdk-android/src/main/java/com/promptsurge/sdk/
│   │       ├── PromptSurge.kt               Public API
│   │       ├── PrePromptDialogFragment.kt   Dialog UI + theming
│   │       └── internal/
│   │           ├── PromptTextRepository.kt  Cache + fetch logic
│   │           ├── PromptDefaults.kt        Bundled fallback copy
│   │           ├── Telemetry.kt             Event queue + flush
│   │           └── EventModels.kt
│   ├── sample-app-android/    Test harness Android app
│   └── shared-types/          Zod schemas shared between api + admin
├── docs/
│   ├── handoff.md             Current-state session handoff ← START HERE
│   ├── api-contract.md        SDK ↔ API wire format
│   ├── conventions.md         Cross-cutting rules
│   ├── data-model.md          Prisma model overview
│   └── deployment.md          Fly.io + Vercel deploy guide
├── .github/workflows/ci.yml   GitHub Actions: lint + typecheck + tests
├── docker-compose.yml         Postgres 16 for local dev
└── pnpm-workspace.yaml
```

---

## Milestone roadmap

| Milestone | Status | Description |
|-----------|--------|-------------|
| M0 | ✅ Done | Repo skeleton, toolchain, CI |
| M1 | ✅ Done | Static pre-prompt → native review (Android SDK) |
| M2 | ✅ Done | Analytics events end-to-end |
| M3 | ✅ Done | Auto-localization (server-driven copy, locale fallback chain) |
| M4 | ✅ Done | Developer + app auth (email/password + OAuth) |
| M5 | ✅ Done | Admin panel UI (Next.js 14, full CRUD) |
| M6 | ✅ Done | Prompt customization + BYOLLM keyword generation |
| M6.5 | ✅ Done | Review-driven theme amplification |
| M7 | ✅ Done | Metrics dashboard (impressions, TTR, RPI, geo, holdout) |
| M8 | ⏳ Pending | Marketing landing page (promptsurge.me) |
| M9 | ✅ Done | Billing integration (Lemon Squeezy, 3 paid tiers + indie) |
| M10 | ✅ Done | Impression metering + enforcement |
| M11 | ✅ Done | Google / GitHub OAuth login |
| M12 | ✅ Done | Team / org invite system |
| M13 | ✅ Done | Developer profile (name, avatar, password change, account delete) |
| M14 | ✅ Done | Holdout group analytics |
| M15 | ✅ Done | Billing portal + invoice history |
| M16 | ✅ Done | App soft-delete, key rotation grace period |
| M17 | ✅ Done | Keywords v2 (bulk add, ban list, audit log, CSV import/export) |
| M18 | ✅ Done | Dialog visual themes (4 presets + custom overrides, SDK theming) |
| M19 | ✅ Done | Sub-lapse warning banners (past_due, cancelled, limit warnings) |
| M20 | 🔜 Next | Marketing landing page |
| M21 | 🔜 Next | Android SDK publish (Maven Central / JitPack) |
| M22 | 🔜 Next | Public launch |

See [docs/handoff.md](docs/handoff.md) for full current state and next-session context.
