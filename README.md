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
│   ├── admin/                 Next.js 14 admin panel (M5+)
│   └── api/                   Fastify API + Prisma (M2+)
├── packages/
│   ├── sdk-android/           Kotlin SDK (Android library) — Gradle root
│   ├── sample-app-android/    Test harness Android app
│   └── shared-types/          Zod schemas shared between api + admin
├── docs/
│   ├── api-contract.md        Single source of truth for SDK ↔ API wire format
│   ├── conventions.md         Cross-cutting rules (auth, rate limits, PII, etc.)
│   ├── data-model.md          Prisma model overview
│   └── runbooks/              Operations, secret rotation, backup/DR
├── .github/workflows/ci.yml   GitHub Actions: lint + typecheck + tests
├── docker-compose.yml         Postgres 16 for local dev
└── pnpm-workspace.yaml
```

---

## Milestone roadmap

| Milestone | Status | Description |
|-----------|--------|-------------|
| M0 | Done | Repo skeleton (this commit) |
| M1 | Next | Static pre-prompt → native review (Android) |
| M2 | | Analytics events end-to-end |
| M3 | | Auto-localization |
| M4 | | Developer + app auth |
| M5 | | Admin panel UI |
| M6 | | Prompt customization + LLM assist |
| M6.5 | | Review-driven theme amplification |
| M7 | | Metrics dashboard |
| M8 | | Marketing site |
| M8.5 | | Production-readiness gate |

See [build plan](../PromptSurge_Build_Plan.md) for full milestone specs and Claude Code prompts.
