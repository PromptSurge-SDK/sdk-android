/**
 * Account settings + OAuth sign-in routes.
 *
 * Public:
 *   POST /admin/auth/oauth            — sign in / sign up via OAuth provider
 *
 * Authenticated (/admin/account/*):
 *   GET    /admin/me                  — extended: now includes hasPassword + oauthProviders
 *   POST   /admin/account/change-password
 *   POST   /admin/account/set-password  (OAuth-only accounts)
 *   GET    /admin/account/oauth         — list linked providers
 *   POST   /admin/account/oauth/unlink  — remove a provider link
 *   DELETE /admin/account               — delete own account
 */

import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { createSession } from '../auth/sessions.js';
import { requireDeveloper } from '../auth/middleware.js';
import { getOrCreateDeveloperOrg } from '../auth/appAccess.js';

export async function registerAdminAccountRoutes(app: FastifyInstance): Promise<void> {
  // ─── OAuth sign-in / sign-up ─────────────────────────────────────────────────
  // Called by the Next.js OAuth callback after it has exchanged the code with the
  // provider and obtained a normalised identity.  Never receives raw OAuth tokens —
  // those stay inside the Next.js server layer.

  app.post(
    '/admin/auth/oauth',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { provider, providerAccountId, email } = request.body as {
        provider: string;
        providerAccountId: string;
        email?: string;
      };

      if (!provider || !providerAccountId) {
        return reply.code(400).send({ error: 'missing_fields' });
      }

      // 1. Look up existing OAuth link.
      const existing = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { developer: true },
      });

      if (existing) {
        const { token, session } = await createSession(existing.developerId);
        return reply.send({
          token,
          expiresAt: session.expiresAt.toISOString(),
          developer: { id: existing.developer.id, email: existing.developer.email },
        });
      }

      // 2. No existing link — try to find developer by email (implicit linking).
      let developer = email
        ? await prisma.developer.findUnique({ where: { email: email.toLowerCase() } })
        : null;

      if (developer) {
        // Create OAuth link for this existing developer.
        await prisma.oAuthAccount.create({
          data: { developerId: developer.id, provider, providerAccountId, email },
        });
      } else {
        // 3. Brand-new account — create developer + org + OAuth link.
        if (!email) {
          return reply.code(400).send({ error: 'email_required_for_new_account' });
        }
        try {
          developer = await prisma.developer.create({
            data: { email: email.toLowerCase(), passwordHash: null },
          });
          await getOrCreateDeveloperOrg(developer.id);
          await prisma.oAuthAccount.create({
            data: { developerId: developer.id, provider, providerAccountId, email },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return reply.code(409).send({ error: 'email_in_use' });
          }
          throw err;
        }
      }

      const { token, session } = await createSession(developer.id);
      return reply.code(201).send({
        token,
        expiresAt: session.expiresAt.toISOString(),
        developer: { id: developer.id, email: developer.email },
      });
    },
  );

  // ─── POST /admin/auth/oauth/link ─────────────────────────────────────────────
  // Authenticated — link a new OAuth provider to the current account.

  app.post(
    '/admin/auth/oauth/link',
    { preHandler: requireDeveloper },
    async (request, reply) => {
      const dev = request.developer!;
      const { provider, providerAccountId, email } = request.body as {
        provider: string;
        providerAccountId: string;
        email?: string;
      };

      if (!provider || !providerAccountId) {
        return reply.code(400).send({ error: 'missing_fields' });
      }

      // Check not already linked to a *different* developer.
      const conflict = await prisma.oAuthAccount.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
      });
      if (conflict && conflict.developerId !== dev.id) {
        return reply.code(409).send({ error: 'provider_linked_to_other_account' });
      }

      await prisma.oAuthAccount.upsert({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        create: { developerId: dev.id, provider, providerAccountId, email },
        update: { email },
      });

      return reply.code(200).send({ ok: true });
    },
  );

  // ─── GET /admin/account/oauth ─────────────────────────────────────────────────

  app.get('/admin/account/oauth', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const accounts = await prisma.oAuthAccount.findMany({
      where: { developerId: dev.id },
      select: { id: true, provider: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({
      accounts: accounts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  });

  // ─── POST /admin/account/oauth/unlink ────────────────────────────────────────

  app.post(
    '/admin/account/oauth/unlink',
    { preHandler: requireDeveloper },
    async (request, reply) => {
      const dev = request.developer!;
      const { provider } = request.body as { provider: string };
      if (!provider) return reply.code(400).send({ error: 'missing_provider' });

      const fullDev = await prisma.developer.findUnique({
        where: { id: dev.id },
        include: { _count: { select: { oauthAccounts: true } } },
      });

      // Guard: must keep at least one login method.
      const hasPassword = fullDev?.passwordHash != null;
      const oauthCount = fullDev?._count.oauthAccounts ?? 0;
      if (!hasPassword && oauthCount <= 1) {
        return reply.code(400).send({ error: 'last_login_method' });
      }

      await prisma.oAuthAccount.deleteMany({
        where: { developerId: dev.id, provider },
      });

      return reply.code(200).send({ ok: true });
    },
  );

  // ─── POST /admin/account/change-password ─────────────────────────────────────

  app.post(
    '/admin/account/change-password',
    { preHandler: requireDeveloper },
    async (request, reply) => {
      const dev = request.developer!;
      const { oldPassword, newPassword } = request.body as {
        oldPassword: string;
        newPassword: string;
      };

      const fullDev = await prisma.developer.findUnique({ where: { id: dev.id } });
      if (!fullDev?.passwordHash) {
        return reply.code(400).send({ error: 'no_password_set' });
      }
      if (!oldPassword || !newPassword) {
        return reply.code(400).send({ error: 'missing_fields' });
      }
      if (newPassword.length < 8) {
        return reply.code(400).send({ error: 'password_too_short' });
      }

      const ok = await verifyPassword(fullDev.passwordHash, oldPassword);
      if (!ok) return reply.code(401).send({ error: 'invalid_password' });

      const newHash = await hashPassword(newPassword);
      await prisma.developer.update({ where: { id: dev.id }, data: { passwordHash: newHash } });

      return reply.code(204).send();
    },
  );

  // ─── POST /admin/account/set-password ────────────────────────────────────────
  // For OAuth-only accounts that want to add a password.

  app.post(
    '/admin/account/set-password',
    { preHandler: requireDeveloper },
    async (request, reply) => {
      const dev = request.developer!;
      const { newPassword } = request.body as { newPassword: string };

      const fullDev = await prisma.developer.findUnique({ where: { id: dev.id } });
      if (fullDev?.passwordHash != null) {
        return reply.code(400).send({ error: 'already_has_password' });
      }
      if (!newPassword || newPassword.length < 8) {
        return reply.code(400).send({ error: 'password_too_short' });
      }

      const hash = await hashPassword(newPassword);
      await prisma.developer.update({ where: { id: dev.id }, data: { passwordHash: hash } });

      return reply.code(204).send();
    },
  );

  // ─── DELETE /admin/account ────────────────────────────────────────────────────

  app.delete('/admin/account', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;

    const appCount = await prisma.app.count({ where: { developerId: dev.id } });
    if (appCount > 0) {
      return reply.code(403).send({
        error: 'owns_apps',
        message: 'Delete or transfer all your apps before deleting your account.',
        count: appCount,
      });
    }

    // Cascade via Prisma schema: Sessions, OAuthAccounts, OrgMemberships are deleted.
    await prisma.developer.delete({ where: { id: dev.id } });

    return reply.code(204).send();
  });
}
