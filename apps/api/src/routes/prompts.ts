import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireApp } from '../auth/middleware.js';

/**
 * Localized pre-prompt copy lookup.
 *
 * Resolution order (first hit wins):
 *   1. App-specific exact locale         (e.g. "de-DE")
 *   2. App-specific language-only        ("de")
 *   3. Global   exact locale
 *   4. Global   language-only
 *   5. Global   "en"
 */
export async function registerPromptsRoute(app: FastifyInstance): Promise<void> {
  app.get('/v1/prompts', { preHandler: requireApp }, async (request, reply) => {
    const appRow = request.app!;
    const requestedLocale = String((request.query as Record<string, unknown>).locale ?? 'en');
    const language = requestedLocale.split(/[-_]/)[0]?.toLowerCase() ?? 'en';

    const candidates: Array<{ appId: string | null; locale: string }> = [
      { appId: appRow.id, locale: requestedLocale },
      { appId: appRow.id, locale: language },
      { appId: null, locale: requestedLocale },
      { appId: null, locale: language },
      { appId: null, locale: 'en' },
    ];

    for (const c of candidates) {
      const found = c.appId === null
        ? await prisma.promptText.findFirst({ where: { appId: null, locale: c.locale } })
        : await prisma.promptText.findFirst({ where: { appId: c.appId, locale: c.locale } });
      if (found) {
        return reply.code(200).send({
          locale: found.locale,
          title: found.title,
          body: found.body,
          ctaConfirm: found.ctaConfirm,
          ctaDismiss: found.ctaDismiss,
        });
      }
    }

    return reply.code(404).send({ error: 'no_prompt_text' });
  });
}
