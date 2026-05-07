import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

const CreateKeywordBody = z.object({
  text: z.string().min(1).max(100),
  type: z.enum(['positive', 'negative']),
});


export async function registerAdminKeywordsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/apps/:appId/keywords', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const keywords = await prisma.keyword.findMany({
      where: { appId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
    return reply.send({ keywords });
  });

  app.post('/admin/apps/:appId/keywords', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = CreateKeywordBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const keyword = await prisma.keyword.create({
      data: { appId, text: parsed.data.text, type: parsed.data.type },
    });
    return reply.code(201).send({ keyword });
  });

  app.delete('/admin/apps/:appId/keywords/:keywordId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, keywordId } = request.params as { appId: string; keywordId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const existing = await prisma.keyword.findFirst({ where: { id: keywordId, appId } });
    if (!existing) return reply.code(404).send({ error: 'keyword_not_found' });

    await prisma.keyword.delete({ where: { id: keywordId } });
    return reply.code(204).send();
  });
}
