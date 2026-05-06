# syntax=docker/dockerfile:1
# Repo root Dockerfile — builds apps/api for production.
# Uses node:20-slim (Debian) throughout so Prisma's OpenSSL dependency is satisfied.

FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── install ───────────────────────────────────────────────────────────────────
FROM base AS install
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --filter api...

# ── build ─────────────────────────────────────────────────────────────────────
FROM install AS build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN pnpm --filter @promptsurge/shared-types build
# Generate Prisma client before tsc so @prisma/client types are available
RUN cd apps/api && npx prisma generate
RUN pnpm --filter api build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api

# Migrations run via fly.toml [deploy] release_command before machines start
CMD ["node", "dist/index.js"]
