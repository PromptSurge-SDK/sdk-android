import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { assertAppAccess } from '../auth/appAccess.js';

// Preset definitions — single source of truth for color resolution
export const DIALOG_PRESETS: Record<string, {
  accentColor: string; backgroundColor: string; textColor: string; buttonTextColor: string;
}> = {
  // Current presets
  system: { backgroundColor: '#FFFBFE', accentColor: '#6750A4', textColor: '#1C1B1F', buttonTextColor: '#FFFFFF' },
  gaming: { backgroundColor: '#542916', accentColor: '#EEC941', textColor: '#FFFFFF',  buttonTextColor: '#542916' },
  sweet:  { backgroundColor: '#1A0D6E', accentColor: '#F990C4', textColor: '#FFFFFF',  buttonTextColor: '#1A0D6E' },
  metal:  { backgroundColor: '#13111A', accentColor: '#A8A8B8', textColor: '#F0F0F5',  buttonTextColor: '#13111A' },
  // Legacy aliases — keep for backward compat with existing stored presetIds
  default:  { backgroundColor: '#FFFBFE', accentColor: '#6750A4', textColor: '#1C1B1F', buttonTextColor: '#FFFFFF' },
  midnight: { backgroundColor: '#542916', accentColor: '#EEC941', textColor: '#FFFFFF',  buttonTextColor: '#542916' },
  ocean:    { backgroundColor: '#1A0D6E', accentColor: '#F990C4', textColor: '#FFFFFF',  buttonTextColor: '#1A0D6E' },
  sunset:   { backgroundColor: '#13111A', accentColor: '#A8A8B8', textColor: '#F0F0F5',  buttonTextColor: '#13111A' },
};

export function resolveTheme(row: {
  presetId: string;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonTextColor: string | null;
}) {
  const base = DIALOG_PRESETS[row.presetId] ?? DIALOG_PRESETS['system']!;
  return {
    presetId: row.presetId,
    accentColor: row.accentColor ?? base.accentColor,
    backgroundColor: row.backgroundColor ?? base.backgroundColor,
    textColor: row.textColor ?? base.textColor,
    buttonTextColor: row.buttonTextColor ?? base.buttonTextColor,
  };
}

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color').nullable();

const UpdateAppearanceBody = z.object({
  presetId: z.enum(['system', 'gaming', 'sweet', 'metal']),
  accentColor: hexColor.optional(),
  backgroundColor: hexColor.optional(),
  textColor: hexColor.optional(),
  buttonTextColor: hexColor.optional(),
});

export async function registerAdminAppearanceRoutes(app: FastifyInstance): Promise<void> {

  // GET /admin/apps/:appId/appearance
  app.get('/admin/apps/:appId/appearance', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const row = await prisma.appDialogTheme.findUnique({ where: { appId } });
    if (!row) {
      return reply.send({
        presetId: 'default',
        accentColor: null,
        backgroundColor: null,
        textColor: null,
        buttonTextColor: null,
        resolved: resolveTheme({ presetId: 'default', accentColor: null, backgroundColor: null, textColor: null, buttonTextColor: null }),
      });
    }
    return reply.send({ ...row, resolved: resolveTheme(row) });
  });

  // PUT /admin/apps/:appId/appearance
  app.put('/admin/apps/:appId/appearance', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = UpdateAppearanceBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.issues });

    const { presetId, accentColor = null, backgroundColor = null, textColor = null, buttonTextColor = null } = parsed.data;

    const row = await prisma.appDialogTheme.upsert({
      where: { appId },
      create: { appId, presetId, accentColor, backgroundColor, textColor, buttonTextColor },
      update: { presetId, accentColor, backgroundColor, textColor, buttonTextColor },
    });

    return reply.send({ ...row, resolved: resolveTheme(row) });
  });
}
