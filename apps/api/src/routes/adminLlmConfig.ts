import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { encryptApiKey, maskApiKey } from '../crypto/index.js';
import { getProvider } from '../llm/factory.js';
import { assertAppAccess } from '../auth/appAccess.js';
import { PROVIDERS } from '../llm/models.js';
import type { GeneratedPrompt } from '../llm/interface.js';

const LlmConfigBody = z.object({
  providerType: z.enum(['openai_compatible', 'anthropic', 'gemini']),
  modelName: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  apiKey: z.string().min(1),
});

const GenerateBody = z.object({
  locale: z.string().min(2).max(10).default('en'),
  count: z.number().int().min(1).max(5).default(3),
  useThemes: z.boolean().optional().default(true),
});


export async function registerAdminLlmConfigRoutes(app: FastifyInstance): Promise<void> {
  // Curated provider + model catalog (no auth needed — it's static public info)
  app.get('/admin/llm/providers', async (_request, reply) => {
    return reply.send({ providers: PROVIDERS });
  });

  // Get current LLM config for an app
  app.get('/admin/apps/:appId/llm-config', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const config = await prisma.llmProviderConfig.findUnique({ where: { appId } });
    if (!config) return reply.send({ config: null });

    // Decrypt to get last-4 for display; never return the real key
    let apiKeyMasked = '***';
    try {
      const plain = await (await import('../crypto/index.js')).decryptApiKey(Buffer.from(config.encryptedApiKey));
      apiKeyMasked = maskApiKey(plain);
    } catch {}

    return reply.send({
      config: {
        providerType: config.providerType,
        modelName: config.modelName,
        baseUrl: config.baseUrl,
        apiKeyMasked,
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  });

  // Create or replace LLM config
  app.put('/admin/apps/:appId/llm-config', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = LlmConfigBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const encryptedApiKey = await encryptApiKey(parsed.data.apiKey);

    const config = await prisma.llmProviderConfig.upsert({
      where: { appId },
      create: {
        appId,
        providerType: parsed.data.providerType,
        modelName: parsed.data.modelName,
        baseUrl: parsed.data.baseUrl ?? null,
        encryptedApiKey,
      },
      update: {
        providerType: parsed.data.providerType,
        modelName: parsed.data.modelName,
        baseUrl: parsed.data.baseUrl ?? null,
        encryptedApiKey,
      },
    });

    return reply.send({
      config: {
        providerType: config.providerType,
        modelName: config.modelName,
        baseUrl: config.baseUrl,
        apiKeyMasked: maskApiKey(parsed.data.apiKey),
        updatedAt: config.updatedAt.toISOString(),
      },
    });
  });

  // Test connection
  app.post('/admin/apps/:appId/llm-config/test', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const config = await prisma.llmProviderConfig.findUnique({ where: { appId } });
    if (!config) return reply.code(400).send({ error: 'no_llm_provider' });

    const provider = await getProvider(config);
    const result = await provider.testConnection();
    return reply.send(result);
  });

  // Generate prompt suggestions
  app.post('/admin/apps/:appId/prompts/generate', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const parsed = GenerateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });

    const config = await prisma.llmProviderConfig.findUnique({ where: { appId } });
    if (!config) return reply.code(400).send({ code: 'no_llm_provider', error: 'No LLM provider configured for this app' });

    const keywords = await prisma.keyword.findMany({ where: { appId } });
    const positiveKeywords = keywords.filter(k => k.type === 'positive').map(k => k.text);
    const negativeKeywords = keywords.filter(k => k.type === 'negative').map(k => k.text);

    // Accepted themes (when useThemes is true)
    const acceptedThemes = parsed.data.useThemes
      ? await prisma.theme.findMany({ where: { appId, status: 'accepted' }, orderBy: { frequency: 'desc' } })
      : [];
    const themeLabels = acceptedThemes.map(t => t.label);

    let generateResult: { prompts: GeneratedPrompt[]; usage: { inputTokens: number; outputTokens: number } };
    let success = true;
    let errorMessage: string | undefined;

    try {
      const provider = await getProvider(config);
      generateResult = await provider.generatePrompts({
        positiveKeywords: [...positiveKeywords, ...themeLabels],
        negativeKeywords,
        locale: parsed.data.locale,
        count: parsed.data.count,
      });
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      // Log failure then return error
      await prisma.llmUsageLog.create({
        data: {
          appId,
          providerType: config.providerType,
          modelName: config.modelName,
          inputTokens: 0,
          outputTokens: 0,
          success: false,
          errorMessage,
          purpose: 'prompt_generation',
        },
      });
      return reply.code(502).send({ error: 'llm_error', message: errorMessage });
    }

    // Log usage
    await prisma.llmUsageLog.create({
      data: {
        appId,
        providerType: config.providerType,
        modelName: config.modelName,
        inputTokens: generateResult.usage.inputTokens,
        outputTokens: generateResult.usage.outputTokens,
        success,
        errorMessage: errorMessage ?? null,
        purpose: 'prompt_generation',
      },
    });

    return reply.send({
      prompts: generateResult.prompts,
      locale: parsed.data.locale,
      influences: {
        keywords: positiveKeywords,
        themes: themeLabels,
      },
    });
  });
}
