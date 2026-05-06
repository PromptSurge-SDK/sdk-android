import type { ApiKey, App } from '@prisma/client';
import { prisma } from '../db.js';
import { generateApiKey } from './tokens.js';

const ROTATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Look up an API key and resolve to the owning App, honoring revocation:
 *   - revokedAt = null            → active
 *   - revokedAt > now             → still in grace window, valid
 *   - revokedAt <= now            → expired, treat as missing
 */
export async function resolveApiKey(
  rawKey: string,
): Promise<{ apiKey: ApiKey; app: App } | null> {
  if (!rawKey) return null;
  const apiKey = await prisma.apiKey.findUnique({
    where: { key: rawKey },
    include: { app: true },
  });
  if (!apiKey) return null;
  if (apiKey.revokedAt && apiKey.revokedAt.getTime() <= Date.now()) return null;
  return { apiKey, app: apiKey.app };
}

/** Issue a fresh active key. */
export async function createApiKey(appId: string): Promise<ApiKey> {
  return prisma.apiKey.create({
    data: { appId, key: generateApiKey() },
  });
}

/**
 * Rotate an app's keys: mark every currently-active key for revocation in 7 days, then issue a
 * fresh key. Within the grace window the SDK can still authenticate with the old key, giving
 * the developer time to ship an app update.
 */
export async function rotateApiKeys(appId: string): Promise<{ apiKey: ApiKey; revokedCount: number }> {
  const graceUntil = new Date(Date.now() + ROTATION_GRACE_MS);
  const result = await prisma.apiKey.updateMany({
    where: { appId, revokedAt: null },
    data: { revokedAt: graceUntil },
  });
  const fresh = await createApiKey(appId);
  return { apiKey: fresh, revokedCount: result.count };
}
