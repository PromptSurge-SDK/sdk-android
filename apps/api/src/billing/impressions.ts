import { prisma } from '../db.js';

interface CacheEntry {
  count: number;
  expiresAt: number;
}

/**
 * In-process impression count cache.
 * Key: `{appId}:{periodStart ISO date}` — one entry per app per billing period.
 * TTL: 60 seconds. Cheap enough to let the count drift slightly between
 * machines; it's only a soft-enforcement gate, not a billing ledger.
 */
const _cache = new Map<string, CacheEntry>();

/** Count pre_prompt_shown events for an app since the given date. Cached 60 s. */
export async function getMonthlyImpressions(appId: string, since: Date): Promise<number> {
  const key = `${appId}:${since.toISOString()}`;
  const hit = _cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.count;

  const count = await prisma.event.count({
    where: {
      appId,
      eventType: 'pre_prompt_shown',
      timestamp: { gte: since },
    },
  });

  _cache.set(key, { count, expiresAt: Date.now() + 60_000 });
  return count;
}

/** Evict cached entry for an app (call after billing period rolls over). */
export function evictImpressionsCache(appId: string): void {
  for (const key of _cache.keys()) {
    if (key.startsWith(`${appId}:`)) _cache.delete(key);
  }
}
