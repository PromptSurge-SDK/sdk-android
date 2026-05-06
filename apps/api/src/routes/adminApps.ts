import type { FastifyInstance } from 'fastify';
import { CreateAppRequest } from '@promptsurge/shared-types';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { createApiKey, rotateApiKeys } from '../auth/apiKeys.js';

export async function registerAdminAppsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/apps', { preHandler: requireDeveloper }, async (request, reply) => {
    const parsed = CreateAppRequest.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const dev = request.developer!;
    const created = await prisma.app.create({
      data: { name: parsed.data.name, developerId: dev.id },
    });
    const key = await createApiKey(created.id);
    return reply.code(201).send({
      app: { id: created.id, name: created.name, createdAt: created.createdAt.toISOString() },
      // Plaintext key returned ONCE — there's no readable list endpoint.
      apiKey: { id: key.id, key: key.key, createdAt: key.createdAt.toISOString() },
    });
  });

  app.get('/admin/apps', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const apps = await prisma.app.findMany({
      where: { developerId: dev.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { apiKeys: true, events: true } },
      },
    });
    return reply.send({
      apps: apps.map((a) => ({
        id: a.id,
        name: a.name,
        createdAt: a.createdAt.toISOString(),
        keyCount: a._count.apiKeys,
        eventCount: a._count.events,
      })),
    });
  });

  app.get('/admin/apps/:appId', { preHandler: requireDeveloper }, async (request, reply) => {
    const params = request.params as { appId: string };
    const dev = request.developer!;
    const found = await prisma.app.findFirst({
      where: { id: params.appId, developerId: dev.id },
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
    });
  });

  app.post('/admin/apps/:appId/keys/rotate', { preHandler: requireDeveloper }, async (request, reply) => {
    const params = request.params as { appId: string };
    const dev = request.developer!;
    const owned = await prisma.app.findFirst({
      where: { id: params.appId, developerId: dev.id },
    });
    if (!owned) return reply.code(404).send({ error: 'app_not_found' });
    const { apiKey, revokedCount } = await rotateApiKeys(owned.id);
    return reply.send({
      apiKey: { id: apiKey.id, key: apiKey.key, createdAt: apiKey.createdAt.toISOString() },
      revokedCount,
      gracePeriodDays: 7,
    });
  });
}
