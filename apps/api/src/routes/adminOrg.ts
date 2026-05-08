/**
 * Organization management routes.
 *
 * GET  /admin/org              — current developer's org details
 * GET  /admin/org/members      — list org members
 * DELETE /admin/org/members/:memberId — remove a member (owner only)
 * POST /admin/org/invites      — create invite link { email, role? }
 * GET  /admin/org/invites      — list pending invites (owner only)
 * DELETE /admin/org/invites/:id — revoke invite (owner only)
 */

import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { getOrCreateDeveloperOrg } from '../auth/appAccess.js';

const INVITE_TTL_DAYS = 7;
const ADMIN_BASE_URL = process.env.ADMIN_ORIGIN ?? 'https://admin.promptsurge.me';

async function requireOwner(organizationId: string, developerId: string) {
  const member = await prisma.organizationMember.findUnique({
    where: { organizationId_developerId: { organizationId, developerId } },
  });
  return member?.role === 'owner' ? member : null;
}

export async function registerAdminOrgRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/org
  app.get('/admin/org', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);
    const myMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_developerId: { organizationId: org.id, developerId: dev.id } },
    });
    return reply.send({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt.toISOString(),
      myRole: myMembership?.role ?? 'member',
    });
  });

  // GET /admin/org/members
  app.get('/admin/org/members', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      include: { developer: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return reply.send({
      members: members.map(m => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        developer: {
          id: m.developer.id,
          email: m.developer.email,
          firstName: m.developer.firstName,
          lastName: m.developer.lastName,
          createdAt: m.developer.createdAt.toISOString(),
        },
      })),
    });
  });

  // DELETE /admin/org/members/:memberId  (owner only, cannot remove self if only owner)
  app.delete('/admin/org/members/:memberId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);

    if (!await requireOwner(org.id, dev.id)) {
      return reply.code(403).send({ error: 'owner_required' });
    }

    const target = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: org.id },
    });
    if (!target) return reply.code(404).send({ error: 'member_not_found' });
    if (target.developerId === dev.id) {
      return reply.code(400).send({ error: 'cannot_remove_self' });
    }

    await prisma.organizationMember.delete({ where: { id: memberId } });
    return reply.code(204).send();
  });

  // POST /admin/org/invites  { email, role? }
  app.post('/admin/org/invites', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);

    if (!await requireOwner(org.id, dev.id)) {
      return reply.code(403).send({ error: 'owner_required' });
    }

    const Body = z.object({
      email: z.string().email(),
      role: z.enum(['owner', 'member']).default('member'),
    });
    const parsed = Body.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    // Check if already a member
    const existingDev = await prisma.developer.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existingDev) {
      const alreadyMember = await prisma.organizationMember.findUnique({
        where: { organizationId_developerId: { organizationId: org.id, developerId: existingDev.id } },
      });
      if (alreadyMember) return reply.code(409).send({ error: 'already_a_member' });
    }

    // Revoke any existing pending invite for same email+org
    await prisma.organizationInvite.deleteMany({
      where: { organizationId: org.id, email: parsed.data.email.toLowerCase(), acceptedAt: null },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId: org.id,
        email: parsed.data.email.toLowerCase(),
        role: parsed.data.role,
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${ADMIN_BASE_URL}/invite/${token}`;
    return reply.code(201).send({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      inviteUrl,
    });
  });

  // GET /admin/org/invites
  app.get('/admin/org/invites', { preHandler: requireDeveloper }, async (request, reply) => {
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);

    if (!await requireOwner(org.id, dev.id)) {
      return reply.code(403).send({ error: 'owner_required' });
    }

    const invites = await prisma.organizationInvite.findMany({
      where: { organizationId: org.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({
      invites: invites.map(i => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        inviteUrl: `${ADMIN_BASE_URL}/invite/${i.token}`,
      })),
    });
  });

  // PATCH /admin/org/members/:memberId  (owner only — update member's name)
  app.patch('/admin/org/members/:memberId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);

    if (!await requireOwner(org.id, dev.id)) {
      return reply.code(403).send({ error: 'owner_required' });
    }

    const Body = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
    });
    const parsed = Body.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const target = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: org.id },
    });
    if (!target) return reply.code(404).send({ error: 'member_not_found' });

    const updated = await prisma.developer.update({
      where: { id: target.developerId },
      data: { firstName: parsed.data.firstName, lastName: parsed.data.lastName },
    });
    return reply.send({ firstName: updated.firstName, lastName: updated.lastName });
  });

  // DELETE /admin/org/invites/:id — revoke
  app.delete('/admin/org/invites/:id', { preHandler: requireDeveloper }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dev = request.developer!;
    const org = await getOrCreateDeveloperOrg(dev.id);

    if (!await requireOwner(org.id, dev.id)) {
      return reply.code(403).send({ error: 'owner_required' });
    }
    await prisma.organizationInvite.deleteMany({ where: { id, organizationId: org.id } });
    return reply.code(204).send();
  });
}
