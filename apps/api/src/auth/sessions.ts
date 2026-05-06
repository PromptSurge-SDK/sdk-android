import type { Developer, Session } from '@prisma/client';
import { prisma } from '../db.js';
import { generateSessionToken } from './tokens.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SLIDING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // refresh if <7 days remaining

/** Issue a fresh session row + return the token (only place the token is generated). */
export async function createSession(developerId: string): Promise<{ session: Session; token: string }> {
  const token = generateSessionToken();
  const session = await prisma.session.create({
    data: {
      developerId,
      token,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return { session, token };
}

/**
 * Validate a bearer token. Returns the Developer if the session exists and is unexpired.
 * Implements sliding-window refresh: if <7 days remain, the expiry is bumped to now+30d on read.
 */
export async function resolveSession(
  token: string,
): Promise<{ developer: Developer; session: Session } | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { developer: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  // Sliding refresh
  if (session.expiresAt.getTime() - Date.now() < SLIDING_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
    });
  }
  return { developer: session.developer, session };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
