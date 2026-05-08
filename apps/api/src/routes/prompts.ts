import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireApp } from '../auth/middleware.js';
import { hardLimit, TIER_LIMITS, currentPeriodStart } from '../billing/tiers.js';
import { getMonthlyImpressions } from '../billing/impressions.js';
import { resolveTheme } from './adminAppearance.js';

/**
 * Localized pre-prompt copy lookup.
 *
 * Resolution order (first hit wins):
 *   1. App-specific active prompts for exact locale   (e.g. "de-DE")
 *   2. App-specific active prompts for language-only  ("de")
 *   3. Global active prompts for exact locale
 *   4. Global active prompts for language-only
 *   5. Global active prompt for "en"
 *
 * Within a matching tier, one prompt is chosen at random (seeded by sessionId for
 * stability within a session — client passes ?sessionId= for deterministic selection).
 *
 * Returns 402 if the app has exceeded its monthly impression hard limit
 * (soft limit × 1.10 grace factor). The SDK should suppress the prompt on 402.
 */
export async function registerPromptsRoute(app: FastifyInstance): Promise<void> {
  app.get('/v1/prompts', { preHandler: requireApp }, async (request, reply) => {
    const appRow = request.app!;
    const q = request.query as Record<string, unknown>;
    const requestedLocale = String(q.locale ?? 'en');
    const sessionId = String(q.sessionId ?? '');
    const language = requestedLocale.split(/[-_]/)[0]?.toLowerCase() ?? 'en';

    // ─── Soft-delete guard ────────────────────────────────────────────────────
    // API key stays valid after soft-delete so the native rating flow still
    // fires, but we return app_deleted so the SDK suppresses our pre-prompt.
    if (appRow.deletedAt) {
      return reply.code(404).send({ error: 'app_deleted' });
    }

    // ─── Impression gate ──────────────────────────────────────────────────────
    const periodStart = currentPeriodStart(appRow);
    const impressions = await getMonthlyImpressions(appRow.id, periodStart);
    const limit = hardLimit(appRow.subscriptionTier);

    if (impressions >= limit) {
      return reply.code(402).send({
        error:      'impression_limit_exceeded',
        tier:       appRow.subscriptionTier,
        impressions,
        limit:      TIER_LIMITS[appRow.subscriptionTier],
        upgradeUrl: 'https://admin.promptsurge.me/billing',
      });
    }

    // ─── Dialog theme ─────────────────────────────────────────────────────────
    const themeRow = await prisma.appDialogTheme.findUnique({ where: { appId: appRow.id } });
    const theme = themeRow ? resolveTheme(themeRow) : null;

    // ─── Prompt lookup ────────────────────────────────────────────────────────
    type Tier = { appId: string | null; locale: string };
    const tiers: Tier[] = [
      { appId: appRow.id, locale: requestedLocale },
      { appId: appRow.id, locale: language },
      { appId: null, locale: requestedLocale },
      { appId: null, locale: language },
      { appId: null, locale: 'en' },
    ];

    for (const tier of tiers) {
      const candidates = await prisma.promptText.findMany({
        where: tier.appId === null
          ? { appId: null, locale: tier.locale, status: 'active' }
          : { appId: tier.appId, locale: tier.locale, status: 'active' },
      });
      if (candidates.length === 0) continue;

      // Deterministic random selection: hash sessionId+appId+locale into an index.
      let idx = 0;
      if (candidates.length > 1 && sessionId) {
        const seed = sessionId + appRow.id + tier.locale;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        }
        idx = Math.abs(hash) % candidates.length;
      } else if (candidates.length > 1) {
        idx = Math.floor(Math.random() * candidates.length);
      }

      const found = candidates[idx]!;
      return reply.code(200).send({
        locale:     found.locale,
        title:      found.title,
        body:       found.body,
        ctaConfirm: found.ctaConfirm,
        ctaDismiss: found.ctaDismiss,
        imageUrl:   found.imageUrl ?? null,
        theme,
      });
    }

    return reply.code(404).send({ error: 'no_prompt_text' });
  });
}
