import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

export async function registerAdminLlmUsageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/apps/:appId/llm-usage', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;

    const owned = await assertAppAccess(appId, dev.id);
    if (!owned) return reply.code(404).send({ error: 'app_not_found' });

    const query = request.query as { page?: string };
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = 50;

    const [logs, total] = await Promise.all([
      prisma.llmUsageLog.findMany({
        where: { appId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.llmUsageLog.count({ where: { appId } }),
    ]);

    return reply.send({
      logs: logs.map(l => ({
        id: l.id,
        providerType: l.providerType,
        modelName: l.modelName,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        success: l.success,
        errorMessage: l.errorMessage,
        purpose: l.purpose,
        createdAt: l.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
    });
  });
}
