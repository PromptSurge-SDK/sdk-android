/**
 * Invite acceptance routes — no auth required for lookup, auth required for acceptance.
 *
 * GET  /admin/invites/:token   — validate token, return org name + email (public)
 * POST /admin/invites/:token/accept — accept invite (must be logged in as matching email or any email)
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';

export async function registerAdminInviteRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/invites/:token — public: validate and return preview
  app.get('/admin/invites/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });

    if (!invite) return reply.code(404).send({ error: 'invite_not_found' });
    if (invite.acceptedAt) return reply.code(410).send({ error: 'invite_already_accepted' });
    if (invite.expiresAt < new Date()) return reply.code(410).send({ error: 'invite_expired' });

    return reply.send({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      orgName: invite.organization.name,
      expiresAt: invite.expiresAt.toISOString(),
    });
  });

  // POST /admin/invites/:token/accept — authenticated: accept invite
  app.post('/admin/invites/:token/accept', { preHandler: requireDeveloper }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const dev = request.developer!;

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
    });

    if (!invite) return reply.code(404).send({ error: 'invite_not_found' });
    if (invite.acceptedAt) return reply.code(410).send({ error: 'invite_already_accepted' });
    if (invite.expiresAt < new Date()) return reply.code(410).send({ error: 'invite_expired' });

    // Check not already a member
    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_developerId: { organizationId: invite.organizationId, developerId: dev.id },
      },
    });
    if (existing) {
      // Already a member — mark invite accepted and succeed silently
      await prisma.organizationInvite.update({ where: { token }, data: { acceptedAt: new Date() } });
      return reply.send({ ok: true, orgId: invite.organizationId, role: existing.role });
    }

    // Create membership + mark accepted in a transaction
    const [member] = await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          developerId: dev.id,
          role: invite.role,
        },
      }),
      prisma.organizationInvite.update({
        where: { token },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return reply.send({ ok: true, orgId: invite.organizationId, role: member.role });
  });
}
