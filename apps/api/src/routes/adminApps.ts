import type { FastifyInstance } from 'fastify';
import { CreateAppRequest } from '@promptsurge/shared-types';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { createApiKey, rotateApiKeys } from '../auth/apiKeys.js';
import { assertAppAccess, getOrCreateDeveloperOrg } from '../auth/appAccess.js';

/** Shared WHERE clause: developer owns app directly OR is an org member. */
function appAccessWhere(appId: string, developerId: string) {
  return {
    id: appId,
    OR: [
      { developerId },
      {
        organizationId: { not: null as null },
        organization: { members: { some: { developerId } } },
      },
    ],
  };
}

const storeMetaSelect = {
  playStoreUrl: true,
  appStoreUrl: true,
  storeIconUrl: true,
  publisherName: true,
  playRating: true,
  appStoreRating: true,
  playReviewCount: true,
  appStoreReviewCount: true,
} as const;

const PatchStoreBody = z.object({
  playStoreUrl: z.string().url().optional().nullable(),
  appStoreUrl: z.string().url().optional().nullable(),
  storeMeta: z
    .object({
      storeIconUrl: z.string().url().optional().nullable(),
      publisherName: z.string().max(200).optional().nullable(),
      playRating: z.number().min(0).max(5).optional().nullable(),
      appStoreRating: z.number().min(0).max(5).optional().nullable(),
      playReviewCount: z.number().int().nonnegative().optional().nullable(),
      appStoreReviewCount: z.number().int().nonnegative().optional().nullable(),
    })
    .optional(),
});

export async function registerAdminAppsRoutes(app: FastifyInstance): Promise<void> {
  // POST /admin/apps — create a new app (auto-links to developer's org)
  app.post('/admin/apps', { preHandler: requireDeveloper }, async (request, reply) => {
    const parsed = CreateAppRequest.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const dev = request.developer!;

    // ── App-creation rate limits ────────────────────────────────────────────
    // Limits are per developer account (the creator), not per org.
    // To bypass for a specific developer, add their ID (comma-separated) to
    // the APP_RATE_LIMIT_BYPASS env var, e.g. "dev_abc123,dev_xyz789".
    const bypassIds = (process.env.APP_RATE_LIMIT_BYPASS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!bypassIds.includes(dev.id)) {
      const DAILY_LIMIT   = parseInt(process.env.APP_DAILY_LIMIT   ?? '5',  10);
      const MONTHLY_LIMIT = parseInt(process.env.APP_MONTHLY_LIMIT  ?? '20', 10);

      const now = new Date();
      const startOfDay = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      ));
      const startOfMonth = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), 1,
      ));

      const [dailyCount, monthlyCount] = await Promise.all([
        prisma.app.count({ where: { developerId: dev.id, createdAt: { gte: startOfDay } } }),
        prisma.app.count({ where: { developerId: dev.id, createdAt: { gte: startOfMonth } } }),
      ]);

      if (dailyCount >= DAILY_LIMIT) {
        return reply.code(429).header('Retry-After', '86400').send({
          error: 'rate_limit_exceeded',
          message: `You can create at most ${DAILY_LIMIT} apps per day. Try again tomorrow.`,
        });
      }
      if (monthlyCount >= MONTHLY_LIMIT) {
        return reply.code(429).send({
          error: 'rate_limit_exceeded',
          message: `You can create at most ${MONTHLY_LIMIT} apps per month. Contact support if you need more.`,
        });
      }
    }
    // ── End rate limits ─────────────────────────────────────────────────────

    // Ensure developer has an org (auto-create if needed)
    const org = await getOrCreateDeveloperOrg(dev.id);

    const { name, playStoreUrl, appStoreUrl, storeMeta } = parsed.data;

    const created = await prisma.app.create({
      data: {
        name,
        developerId: dev.id,
        organizationId: org.id,
        ...(playStoreUrl != null ? { playStoreUrl } : {}),
        ...(appStoreUrl != null ? { appStoreUrl } : {}),
        ...(storeMeta
          ? {
              storeIconUrl: storeMeta.storeIconUrl ?? undefined,
              publisherName: storeMeta.publisherName ?? undefined,
              playRating: storeMeta.playRating ?? undefined,
              appStoreRating: storeMeta.appStoreRating ?? undefined,
              playReviewCount: storeMeta.playReviewCount ?? undefined,
              appStoreReviewCount: storeMeta.appStoreReviewCount ?? undefined,
              storeMetaUpdatedAt: new Date(),
            }
          : {}),
      },
    });
    const key = await createApiKey(created.id);
    return reply.code(201).send({
      app: { id: created.id, name: created.name, createdAt: created.createdAt.toISOString() },
      apiKey: { id: key.id, key: key.key, createdAt: key.createdAt.toISOString() },
    });
  });

  // GET /admin/apps — list all apps the developer can access (own + org memberships)
  app.get('/admin/apps', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const apps = await prisma.app.findMany({
      where: {
        OR: [
          { developerId: dev.id },
          {
            organizationId: { not: null },
            organization: { members: { some: { developerId: dev.id } } },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { apiKeys: true, events: true } },
        ...storeMetaSelect,
      },
    });
    return reply.send({
      apps: apps.map((a) => ({
        id: a.id,
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        keyCount: a._count.apiKeys,
        eventCount: a._count.events,
        playStoreUrl: a.playStoreUrl,
        appStoreUrl: a.appStoreUrl,
        storeIconUrl: a.storeIconUrl,
        publisherName: a.publisherName,
        playRating: a.playRating,
        appStoreRating: a.appStoreRating,
        playReviewCount: a.playReviewCount,
        appStoreReviewCount: a.appStoreReviewCount,
      })),
    });
  });

  // GET /admin/apps/:appId
  app.get('/admin/apps/:appId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    const found = await prisma.app.findFirst({
      where: appAccessWhere(appId, dev.id),
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { apiKeys: true, events: true } },
        apiKeys: {
          where: { OR: [{ revokedAt: null }, { revokedAt: { gt: new Date() } }] },
          select: { id: true, createdAt: true, revokedAt: true },
          orderBy: { createdAt: 'desc' },
        },
        ...storeMetaSelect,
      },
    });
    if (!found) return reply.code(404).send({ error: 'app_not_found' });
    return reply.send({
      id: found.id,
      name: found.name,
      createdAt: found.createdAt.toISOString(),
      keyCount: found._count.apiKeys,
      eventCount: found._count.events,
      activeKeys: found.apiKeys.map((k) => ({
        id: k.id,
        createdAt: k.createdAt.toISOString(),
        revokedAt: k.revokedAt?.toISOString() ?? null,
      })),
      playStoreUrl: found.playStoreUrl,
      appStoreUrl: found.appStoreUrl,
      storeIconUrl: found.storeIconUrl,
      publisherName: found.publisherName,
      playRating: found.playRating,
      appStoreRating: found.appStoreRating,
      playReviewCount: found.playReviewCount,
      appStoreReviewCount: found.appStoreReviewCount,
    });
  });

  // PATCH /admin/apps/:appId/store — update store URLs and metadata
  app.patch('/admin/apps/:appId/store', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const parsed = PatchStoreBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const owned = await assertAppAccess(appId, dev.id);
    if (!owned) return reply.code(404).send({ error: 'app_not_found' });

    const { playStoreUrl, appStoreUrl, storeMeta } = parsed.data;

    const updated = await prisma.app.update({
      where: { id: appId },
      data: {
        ...(playStoreUrl !== undefined ? { playStoreUrl } : {}),
        ...(appStoreUrl !== undefined ? { appStoreUrl } : {}),
        ...(storeMeta !== undefined
          ? {
              storeIconUrl: storeMeta.storeIconUrl ?? undefined,
              publisherName: storeMeta.publisherName ?? undefined,
              playRating: storeMeta.playRating ?? undefined,
              appStoreRating: storeMeta.appStoreRating ?? undefined,
              playReviewCount: storeMeta.playReviewCount ?? undefined,
              appStoreReviewCount: storeMeta.appStoreReviewCount ?? undefined,
              storeMetaUpdatedAt: new Date(),
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        ...storeMetaSelect,
        storeMetaUpdatedAt: true,
      },
    });

    return reply.send({
      id: updated.id,
      name: updated.name,
      playStoreUrl: updated.playStoreUrl,
      appStoreUrl: updated.appStoreUrl,
      storeIconUrl: updated.storeIconUrl,
      publisherName: updated.publisherName,
      playRating: updated.playRating,
      appStoreRating: updated.appStoreRating,
      playReviewCount: updated.playReviewCount,
      appStoreReviewCount: updated.appStoreReviewCount,
      storeMetaUpdatedAt: updated.storeMetaUpdatedAt?.toISOString() ?? null,
    });
  });

  // POST /admin/apps/:appId/keys/rotate
  app.post('/admin/apps/:appId/keys/rotate', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    const owned = await assertAppAccess(appId, dev.id);
    if (!owned) return reply.code(404).send({ error: 'app_not_found' });
    const { apiKey, revokedCount } = await rotateApiKeys(owned.id);
    return reply.send({
      apiKey: { id: apiKey.id, key: apiKey.key, createdAt: apiKey.createdAt.toISOString() },
      revokedCount,
      gracePeriodDays: 7,
    });
  });
}
