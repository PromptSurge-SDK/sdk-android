import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

function isOneOrTwoWords(s: string) {
  return s.trim().split(/\s+/).length <= 2;
}

const CreateKeywordsBody = z.object({
  texts: z.array(
    z.string().min(1).max(50).refine(isOneOrTwoWords, 'Each keyword must be 1–2 words'),
  ).min(1).max(50),
  type: z.enum(['positive', 'negative']),
});

function keywordsToCsv(keywords: { text: string; type: string; createdAt: Date }[]): string {
  const rows = keywords.map(k => `"${k.text.replace(/"/g, '""')}","${k.type}","${k.createdAt.toISOString()}"`);
  return ['text,type,createdAt', ...rows].join('\n');
}

function auditToCsv(logs: { keyword: string; action: string; type: string; changedByEmail: string; changedAt: Date }[]): string {
  const rows = logs.map(l =>
    `"${l.keyword.replace(/"/g, '""')}","${l.action}","${l.type}","${l.changedByEmail}","${l.changedAt.toISOString()}"`,
  );
  return ['keyword,action,type,changedByEmail,changedAt', ...rows].join('\n');
}

export async function registerAdminKeywordsRoutes(app: FastifyInstance): Promise<void> {

  // GET /admin/apps/:appId/keywords/banned — global ban list (read-only, for UI display)
  app.get('/admin/apps/:appId/keywords/banned', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const banned = await prisma.bannedKeyword.findMany({
      orderBy: { keyword: 'asc' },
      select: { keyword: true },
    });
    return reply.send({ banned: banned.map(b => b.keyword), total: banned.length });
  });

  // GET /admin/apps/:appId/keywords — alphabetical
  app.get('/admin/apps/:appId/keywords', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const keywords = await prisma.keyword.findMany({
      where: { appId },
      orderBy: [{ type: 'asc' }, { text: 'asc' }],
    });
    return reply.send({ keywords });
  });

  // GET /admin/apps/:appId/keywords/audit-log
  app.get('/admin/apps/:appId/keywords/audit-log', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const { format } = request.query as { format?: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const logs = await prisma.keywordAuditLog.findMany({
      where: { appId },
      orderBy: { changedAt: 'desc' },
      take: 500,
    });

    if (format === 'csv') {
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="keyword-audit-log.csv"');
      return reply.send(auditToCsv(logs));
    }
    return reply.send({ logs });
  });

  // GET /admin/apps/:appId/keywords/export
  app.get('/admin/apps/:appId/keywords/export', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const keywords = await prisma.keyword.findMany({
      where: { appId },
      orderBy: [{ type: 'asc' }, { text: 'asc' }],
    });

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="keywords.csv"');
    return reply.send(keywordsToCsv(keywords));
  });

  // POST /admin/apps/:appId/keywords — comma-separated batch create
  app.post('/admin/apps/:appId/keywords', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = CreateKeywordsBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const { texts, type } = parsed.data;
    const normalised = texts.map(t => t.trim().toLowerCase()).filter(Boolean);

    // Check ban list (case-insensitive)
    const banned = await prisma.bannedKeyword.findMany({
      where: { keyword: { in: normalised } },
      select: { keyword: true },
    });
    const bannedSet = new Set(banned.map(b => b.keyword));

    // Check for existing duplicates
    const existing = await prisma.keyword.findMany({
      where: { appId, text: { in: normalised } },
      select: { text: true },
    });
    const existingSet = new Set(existing.map(e => e.text));

    const toCreate = normalised.filter(t => !bannedSet.has(t) && !existingSet.has(t));

    const created = await Promise.all(
      toCreate.map(text => prisma.keyword.create({ data: { appId, text, type } })),
    );

    // Audit log
    if (created.length > 0) {
      await prisma.keywordAuditLog.createMany({
        data: created.map(k => ({
          appId,
          keyword: k.text,
          action: 'added' as const,
          type: k.type,
          changedById: dev.id,
          changedByEmail: dev.email,
        })),
      });
    }

    return reply.code(201).send({
      created,
      banned: [...bannedSet].filter(t => normalised.includes(t)),
      duplicates: [...existingSet].filter(t => normalised.includes(t)),
    });
  });

  // POST /admin/apps/:appId/keywords/import — CSV bulk import
  app.post('/admin/apps/:appId/keywords/import', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const ImportBody = z.object({
      csv: z.string().max(100_000),
      type: z.enum(['positive', 'negative']),
    });
    const parsed = ImportBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const lines = parsed.data.csv.split('\n').map(l => l.trim().replace(/^"|"$/g, '').toLowerCase()).filter(Boolean);
    // Skip header if present
    const allLines = lines[0] === 'text' || lines[0].startsWith('text,') ? lines.slice(1) : lines;
    // Enforce 1–2 word limit; silently drop longer phrases
    const normalised = allLines.filter(isOneOrTwoWords).slice(0, 200);

    const banned = await prisma.bannedKeyword.findMany({
      where: { keyword: { in: normalised } },
      select: { keyword: true },
    });
    const bannedSet = new Set(banned.map(b => b.keyword));

    const existing = await prisma.keyword.findMany({
      where: { appId, text: { in: normalised } },
      select: { text: true },
    });
    const existingSet = new Set(existing.map(e => e.text));

    const toCreate = normalised.filter(t => !bannedSet.has(t) && !existingSet.has(t));

    const created = await Promise.all(
      toCreate.map(text => prisma.keyword.create({ data: { appId, text, type: parsed.data.type } })),
    );

    if (created.length > 0) {
      await prisma.keywordAuditLog.createMany({
        data: created.map(k => ({
          appId,
          keyword: k.text,
          action: 'added' as const,
          type: k.type,
          changedById: dev.id,
          changedByEmail: dev.email,
        })),
      });
    }

    return reply.code(201).send({
      created,
      banned: [...bannedSet].filter(t => normalised.includes(t)),
      duplicates: [...existingSet].filter(t => normalised.includes(t)),
    });
  });

  // DELETE /admin/apps/:appId/keywords/:keywordId
  app.delete('/admin/apps/:appId/keywords/:keywordId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, keywordId } = request.params as { appId: string; keywordId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const existing = await prisma.keyword.findFirst({ where: { id: keywordId, appId } });
    if (!existing) return reply.code(404).send({ error: 'keyword_not_found' });

    await prisma.keyword.delete({ where: { id: keywordId } });

    await prisma.keywordAuditLog.create({
      data: {
        appId,
        keyword: existing.text,
        action: 'removed',
        type: existing.type,
        changedById: dev.id,
        changedByEmail: dev.email,
      },
    });

    return reply.code(204).send();
  });
}
