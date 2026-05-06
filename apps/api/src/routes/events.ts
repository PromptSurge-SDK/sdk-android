import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { BatchSchema } from '@promptsurge/shared-types';
import { prisma } from '../db.js';
import { requireApp } from '../auth/middleware.js';

export async function registerEventsRoute(app: FastifyInstance): Promise<void> {
  app.post('/v1/events', { preHandler: requireApp }, async (request, reply) => {
    const appRow = request.app!;

    const parsed = BatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_batch',
        issues: parsed.error.issues,
      });
    }

    const rows = parsed.data.events.map((e) => {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const rl = payload.resolvedLocale;
      return {
        appId: appRow.id,
        eventType: e.eventType,
        eventId: e.eventId,
        timestamp: new Date(e.timestamp),
        sessionId: e.sessionId,
        deviceId: e.deviceId,
        appVersion: e.appVersion,
        sdkVersion: e.sdkVersion,
        locale: e.locale,
        resolvedLocale: typeof rl === 'string' && rl.length > 0 ? rl : null,
        platform: e.platform,
        payload: payload as Prisma.InputJsonValue,
      };
    });

    const result = await prisma.event.createMany({
      data: rows,
      skipDuplicates: true,
    });

    return reply.code(202).send({
      accepted: result.count,
      skipped: rows.length - result.count,
    });
  });
}
