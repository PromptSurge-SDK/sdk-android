import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';

const PAGE_SIZE = 50;
const MAX_TOTAL = 1000;

/**
 * Read events for the authenticated developer's apps.
 *
 * Optional `?appId=` filter narrows to a specific app the developer owns. Without it, all of
 * the developer's apps are unioned. Cross-tenant isolation is enforced by the
 * `developerId = request.developer.id` join rule.
 */
export async function registerAdminEventsRoute(app: FastifyInstance): Promise<void> {
  app.get('/admin/events', { preHandler: requireDeveloper }, async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? '1') | 0);
    const offset = (page - 1) * PAGE_SIZE;
    const dev = request.developer!;

    if (offset >= MAX_TOTAL) {
      return reply.send({ events: [], page, pageSize: PAGE_SIZE, total: MAX_TOTAL, hasMore: false });
    }

    const where = q.appId
      ? { app: { developerId: dev.id }, appId: q.appId }
      : { app: { developerId: dev.id } };

    const [rows, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: PAGE_SIZE,
        select: {
          id: true,
          eventType: true,
          timestamp: true,
          deviceId: true,
          appVersion: true,
          locale: true,
          resolvedLocale: true,
          platform: true,
        },
      }),
      prisma.event.count({ where }),
    ]);

    return reply.send({
      events: rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        timestamp: r.timestamp.toISOString(),
        deviceId: r.deviceId,
        appVersion: r.appVersion,
        locale: r.locale,
        resolvedLocale: r.resolvedLocale,
        platform: r.platform,
      })),
      page,
      pageSize: PAGE_SIZE,
      total: Math.min(total, MAX_TOTAL),
      hasMore: offset + rows.length < Math.min(total, MAX_TOTAL),
    });
  });
}
