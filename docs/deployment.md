# PromptSurge Deployment Guide

## Services overview

| Service | Platform | URL |
|---------|----------|-----|
| API | Fly.io (`promptsurge` app, region `iad`) | `https://api.promptsurge.me` |
| Admin panel | Vercel (`promptsurges-projects/admin`) | `https://admin.promptsurge.me` |
| Marketing site | Vercel (`promptsurges-projects/marketing`) | `https://promptsurge.me` |
| Database | Supabase (PostgreSQL) | Managed |
| Object storage | AWS S3 + CloudFront | `https://cdn.promptsurge.me` |

---

## DNS records required

All records should be set at your domain registrar or DNS provider for `promptsurge.me`.

### Apex domain — marketing site (`promptsurge.me`)

Vercel requires an `A` record for the apex domain pointing to their load balancer, plus a `CNAME` for `www`:

```
Type  Host  Value
A     @     76.76.21.21        # Vercel load balancer IP (verify current IP in Vercel dashboard)
CNAME www   cname.vercel-dns.com
```

To configure: in the Vercel `marketing` project → Settings → Domains → Add domain `promptsurge.me`.
Vercel will display the exact `A` record value to use.

### Admin panel (`admin.promptsurge.me`)

```
Type   Host   Value
CNAME  admin  cname.vercel-dns.com
```

To configure: in the Vercel `admin` project → Settings → Domains → Add domain `admin.promptsurge.me`.

### API (`api.promptsurge.me`)

Fly.io provides a shared IP by default. Add a CNAME to the Fly.io app URL:

```
Type   Host  Value
CNAME  api   promptsurge.fly.dev
```

To configure: in `fly.toml`, add a `[[services.ports]]` block and run `fly certs create api.promptsurge.me`.

### CDN for uploaded images (`cdn.promptsurge.me`)

Once CloudFront is configured in front of the S3 bucket:

```
Type   Host  Value
CNAME  cdn   <cloudfront-distribution-id>.cloudfront.net
```

---

## Environment variables

> [!IMPORTANT]
> **Billing activation required before M8.5 (production-gate milestone)**
>
> The following six Fly.io secrets must be set before the production-gate milestone is cut:
>
> ```
> fly secrets set \
>   LEMONSQUEEZY_WEBHOOK_SECRET=<value> \
>   LS_API_KEY=<value> \
>   LS_STORE_ID=<value> \
>   LS_VARIANT_STARTUP=<value> \
>   LS_VARIANT_GROWTH=<value> \
>   LS_VARIANT_ENTERPRISE=<value>
> ```
>
> In addition, register the Lemon Squeezy webhook in the **Lemon Squeezy dashboard → Settings → Webhooks**:
>
> - **URL:** `https://api.promptsurge.me/webhooks/lemonsqueezy`
> - **Events to subscribe:** `subscription_created`, `subscription_updated`, `subscription_cancelled`,
>   `subscription_expired`, `subscription_paused`, `subscription_resumed`

### Fly.io API secrets (set via `fly secrets set KEY=VALUE`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `ADMIN_ORIGIN` | `https://admin.promptsurge.me` (CORS allowlist) |
| `LLM_KEY_ENCRYPTION_PRIVATE` | Base64-encoded libsodium private key for LLM key encryption |
| `LLM_KEY_ENCRYPTION_PUBLIC` | Base64-encoded libsodium public key for LLM key encryption |
| `S3_BUCKET` | S3 bucket name for image uploads |
| `S3_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | AWS credential for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS credential for S3 uploads |
| `CDN_BASE_URL` | `https://cdn.promptsurge.me` |
| `REDIS_URL` | Redis connection string (optional — BullMQ scheduler disabled if unset) |
| `DEFAULT_LLM_PROVIDER` | Platform default LLM provider (`anthropic`, `openai_compatible`, or `gemini`) |
| `DEFAULT_LLM_MODEL` | Model name for the platform default (e.g. `claude-haiku-4-5-20251001`) |
| `DEFAULT_LLM_KEY` | API key for the platform default provider |
| `DEFAULT_LLM_BASE_URL` | Base URL for OpenAI-compatible providers (optional, omit for OpenAI/Anthropic/Gemini) |

### Vercel admin environment variables

| Variable | Description |
|----------|-------------|
| `PROMPTSURGE_API_URL` | `https://api.promptsurge.me` (server-side fetch) |
| `NEXT_PUBLIC_API_URL` | `https://api.promptsurge.me` (client-side fetch) |
| `SESSION_SECRET` | Secret for signing session cookies |

---

## Automatic deployment (GitHub Actions)

Push to `master` triggers `.github/workflows/deploy.yml`, which deploys admin and marketing to Vercel in parallel. The workflow requires four repository secrets — set them once in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | `vca_0Yyjt7vxbDZU7OiMbgkVCcxKBbH4NI5s4AAwMGQdO8ecJg5TKT1AhFEF` |
| `VERCEL_ORG_ID` | `team_1BbvpAqtIeiXXRBG09BvLQ7i` |
| `VERCEL_PROJECT_ID_ADMIN` | `prj_4fyi1g2IX1qd4BmanDXpoJ5VpLvA` |
| `VERCEL_PROJECT_ID_MARKETING` | `prj_l6J2SQZAbZwAJg4P2fy1B0d9pYBG` |

The API (Fly.io) is not yet in the deploy pipeline. Run manually until a `FLY_API_TOKEN` secret is added:

```bash
# Deploy from repo root (fly.toml is at root)
~/.fly/bin/flyctl deploy --remote-only

# Apply pending migrations
cd apps/api && npx prisma migrate deploy
```

## Manual deployment commands

Use these as fallback or for one-off deploys.

### Admin panel

```bash
cd apps/admin
npx vercel --prod
```

### Marketing site

```bash
cd apps/marketing
npx vercel --prod
```

---

## Notes

- The marketing site is fully static (`○` in Next.js build output) — all pages prerendered at build time. No server-side rendering, no API calls. CDN-cached by Vercel Edge.
- The admin panel uses `force-dynamic` on data pages. Vercel Edge Functions handle SSR.
- The API uses Fly.io with `auto_stop_machines = true` and `min_machines_running = 0` — machines sleep when idle and cold-start on demand.
- LLM keys (`LLM_KEY_ENCRYPTION_PRIVATE`/`LLM_KEY_ENCRYPTION_PUBLIC`) are stored as Fly.io secrets (encrypted at rest). No external KMS is needed at current scale.
