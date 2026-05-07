/**
 * Shared app-access guard used by all admin routes.
 *
 * A developer may access an App if:
 *   1. They are the direct owner (App.developerId === developerId) — legacy/fallback, or
 *   2. They are a member of the Organization that owns the App (App.organizationId is set).
 *
 * Returns the App row on success, null on failure.
 */

import { prisma } from '../db.js';
import type { App } from '@prisma/client';

export async function assertAppAccess(
  appId: string,
  developerId: string,
): Promise<App | null> {
  return prisma.app.findFirst({
    where: {
      id: appId,
      OR: [
        // Direct ownership (pre-org legacy or fallback)
        { developerId },
        // Org membership
        {
          organizationId: { not: null },
          organization: {
            members: { some: { developerId } },
          },
        },
      ],
    },
  });
}

/**
 * Returns the Organization for a developer (the one where they are a member).
 * Creates one automatically if the developer has no org (shouldn't happen post-signup,
 * but guards against edge cases).
 */
export async function getOrCreateDeveloperOrg(developerId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { developerId },
    include: { organization: true },
    orderBy: { joinedAt: 'asc' },
  });

  if (membership) return membership.organization;

  // Fallback: auto-create org (should only happen in dev/test)
  const dev = await prisma.developer.findUniqueOrThrow({ where: { id: developerId } });
  const org = await prisma.organization.create({
    data: {
      name: dev.email.split('@')[0] ?? 'My Team',
      members: {
        create: { developerId, role: 'owner' },
      },
    },
  });

  // Link any orphaned apps
  await prisma.app.updateMany({
    where: { developerId, organizationId: null },
    data: { organizationId: org.id },
  });

  return org;
}
