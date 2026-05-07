import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { LoginRequest, SignupRequest } from '@promptsurge/shared-types';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession, deleteSession } from '../auth/sessions.js';
import { requireDeveloper } from '../auth/middleware.js';
import { getOrCreateDeveloperOrg } from '../auth/appAccess.js';

export async function registerAdminAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/admin/signup', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = SignupRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const passwordHash = await hashPassword(parsed.data.password);
    try {
      const developer = await prisma.developer.create({
        data: { email: parsed.data.email.toLowerCase(), passwordHash },
      });
      // Auto-create personal org for new developer
      await getOrCreateDeveloperOrg(developer.id);
      const { token, session } = await createSession(developer.id);
      return reply.code(201).send({
        token,
        expiresAt: session.expiresAt.toISOString(),
        developer: { id: developer.id, email: developer.email },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.code(409).send({ error: 'email_in_use' });
      }
      throw err;
    }
  });

  app.post('/admin/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = LoginRequest.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' });
    }
    const developer = await prisma.developer.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (!developer) {
      // Constant-time-ish: still hash to avoid trivial timing oracle on email existence.
      await hashPassword(parsed.data.password).catch(() => undefined);
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    // OAuth-only accounts have no password — return generic invalid_credentials to
    // avoid leaking that the email exists (timing is still slightly off, but acceptable).
    if (!developer.passwordHash) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const ok = await verifyPassword(developer.passwordHash, parsed.data.password);
    if (!ok) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const { token, session } = await createSession(developer.id);
    return reply.code(200).send({
      token,
      expiresAt: session.expiresAt.toISOString(),
      developer: { id: developer.id, email: developer.email },
    });
  });

  app.post('/admin/logout', { preHandler: requireDeveloper }, async (request, reply) => {
    const auth = request.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (token) await deleteSession(token);
    return reply.code(204).send();
  });

  app.get('/admin/me', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const full = await prisma.developer.findUnique({
      where: { id: dev.id },
      include: { oauthAccounts: { select: { provider: true } } },
    });
    return reply.send({
      id: dev.id,
      email: dev.email,
      createdAt: dev.createdAt.toISOString(),
      hasPassword: full?.passwordHash != null,
      oauthProviders: full?.oauthAccounts.map((a) => a.provider) ?? [],
    });
  });
}
