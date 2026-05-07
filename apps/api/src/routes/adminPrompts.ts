import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

const CreatePromptBody = z.object({
  locale: z.string().min(2).max(10),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(300),
  ctaConfirm: z.string().min(1).max(30),
  ctaDismiss: z.string().min(1).max(30),
  imageUrl: z.string().url().optional().nullable(),
  status: z.enum(['draft', 'active', 'discarded']).optional(),
  sourceKeywords: z.array(z.string()).optional(),
  generatedByLlm: z.boolean().optional(),
});

const UpdatePromptBody = CreatePromptBody.partial();


export async function registerAdminPromptsRoutes(app: FastifyInstance): Promise<void> {
  // List prompts for an app
  app.get('/admin/apps/:appId/prompts', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const prompts = await prisma.promptText.findMany({
      where: { appId },
      orderBy: [{ locale: 'asc' }, { createdAt: 'desc' }],
    });
    return reply.send({ prompts });
  });

  // Create a prompt
  app.post('/admin/apps/:appId/prompts', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = CreatePromptBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const prompt = await prisma.promptText.create({
      data: {
        appId,
        locale: parsed.data.locale,
        title: parsed.data.title,
        body: parsed.data.body,
        ctaConfirm: parsed.data.ctaConfirm,
        ctaDismiss: parsed.data.ctaDismiss,
        imageUrl: parsed.data.imageUrl ?? null,
        status: parsed.data.status ?? 'active',
        sourceKeywords: parsed.data.sourceKeywords ?? [],
        generatedByLlm: parsed.data.generatedByLlm ?? false,
      },
    });
    return reply.code(201).send({ prompt });
  });

  // Update a prompt
  app.patch('/admin/apps/:appId/prompts/:promptId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, promptId } = request.params as { appId: string; promptId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = UpdatePromptBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const existing = await prisma.promptText.findFirst({ where: { id: promptId, appId } });
    if (!existing) return reply.code(404).send({ error: 'prompt_not_found' });

    const updated = await prisma.promptText.update({
      where: { id: promptId },
      data: {
        ...(parsed.data.locale !== undefined && { locale: parsed.data.locale }),
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
        ...(parsed.data.ctaConfirm !== undefined && { ctaConfirm: parsed.data.ctaConfirm }),
        ...(parsed.data.ctaDismiss !== undefined && { ctaDismiss: parsed.data.ctaDismiss }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.sourceKeywords !== undefined && { sourceKeywords: parsed.data.sourceKeywords }),
        ...(parsed.data.generatedByLlm !== undefined && { generatedByLlm: parsed.data.generatedByLlm }),
      },
    });
    return reply.send({ prompt: updated });
  });

  // Delete a prompt
  app.delete('/admin/apps/:appId/prompts/:promptId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, promptId } = request.params as { appId: string; promptId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const existing = await prisma.promptText.findFirst({ where: { id: promptId, appId } });
    if (!existing) return reply.code(404).send({ error: 'prompt_not_found' });

    await prisma.promptText.delete({ where: { id: promptId } });
    return reply.code(204).send();
  });
}
