import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireDeveloper } from '../auth/middleware.js';
import { THEME_EXTRACTION_SYSTEM_PROMPT } from '../llm/system-prompts.js';
import { parseReviews, filterHighRated } from '../reviews/parser.js';
import { estimateCost, estimateTokens } from '../llm/cost.js';
import { assertAppAccess } from '../auth/appAccess.js';
import { resolveProvider } from '../llm/factory.js';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ANALYZE_RATE_LIMIT_PER_DAY = 10;


function sha256(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

interface ExtractedTheme {
  theme: string;
  frequency: number;
  examplePhrases: string[];
}

function parseThemesResponse(raw: string): ExtractedTheme[] {
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed)) throw new Error('LLM response is not an array');
  return parsed as ExtractedTheme[];
}

export async function registerAdminThemesRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/apps/:appId/themes — list themes
  app.get('/admin/apps/:appId/themes', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const { status } = request.query as { status?: string };
    const whereStatus = status
      ? { status: status as 'pending' | 'accepted' | 'discarded' }
      : { status: { not: 'discarded' as const } };

    const themes = await prisma.theme.findMany({
      where: { appId, ...whereStatus },
      orderBy: [{ frequency: 'desc' }, { createdAt: 'desc' }],
    });

    return reply.send({ themes });
  });

  // POST /admin/apps/:appId/themes/analyze — parse, estimate cost, then (if confirmed) call LLM
  app.post('/admin/apps/:appId/themes/analyze', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const BodySchema = z.object({
      text: z.string().min(1).max(200_000),
      confirmed: z.boolean().optional().default(false),
      sourceHash: z.string().optional(),
    });

    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });

    const { text, confirmed, sourceHash: clientHash } = parsed.data;
    const sourceHash = sha256(text);

    // Verify hash matches if client provided it (sanity check)
    if (clientHash && clientHash !== sourceHash) {
      return reply.code(400).send({ error: 'hash_mismatch' });
    }

    const appConfig = await prisma.llmProviderConfig.findUnique({ where: { appId } });
    const resolved = await resolveProvider(appConfig);
    if (!resolved) return reply.code(503).send({ code: 'no_llm_provider', error: 'No LLM provider available — contact support.' });

    // Parse reviews + filter
    const reviews = parseReviews(text);
    const { filtered, reviewCount, filteredCount } = filterHighRated(reviews);

    if (filteredCount === 0) {
      return reply.code(422).send({ error: 'no_reviews_after_filter', reviewCount });
    }

    // Check 7-day cache
    const cutoff = new Date(Date.now() - CACHE_TTL_MS);
    const cachedRun = await prisma.reviewAnalysisRun.findFirst({
      where: { appId, sourceHash, status: 'completed', createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });

    if (cachedRun) {
      const themes = await prisma.theme.findMany({
        where: { appId, sourceHash },
        orderBy: { frequency: 'desc' },
      });
      return reply.send({ cached: true, cachedAt: cachedRun.createdAt.toISOString(), themes, reviewCount, filteredCount });
    }

    // Check per-day rate limit (cache hits are exempt — already returned above)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayRuns = await prisma.reviewAnalysisRun.count({
      where: { appId, status: { not: 'cached' }, createdAt: { gte: dayAgo } },
    });
    if (todayRuns >= ANALYZE_RATE_LIMIT_PER_DAY) {
      return reply.code(429).send({ error: 'rate_limit_exceeded', limit: ANALYZE_RATE_LIMIT_PER_DAY });
    }

    // Build prompt text for token estimation
    const reviewText = filtered.map(r => r.text).join('\n\n');

    // Cost confirmation only shown when using the user's own LLM key
    if (resolved.source === 'app' && !confirmed) {
      const estimatedInputTokens = estimateTokens(THEME_EXTRACTION_SYSTEM_PROMPT + reviewText);
      const estimatedOutputTokens = 500;
      const estimatedCostUsd = estimateCost(resolved.providerType, resolved.modelName, estimatedInputTokens, estimatedOutputTokens);
      return reply.send({ needsConfirmation: true, estimatedCostUsd, reviewCount, filteredCount, sourceHash });
    }

    // Step 2: Confirmed — run LLM
    const run = await prisma.reviewAnalysisRun.create({
      data: { appId, sourceHash, reviewCount, filteredCount, status: 'pending' },
    });

    let themes: ExtractedTheme[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let llmSuccess = true;
    let errorMessage: string | undefined;

    try {
      const rawResult = await callThemeExtraction(resolved, reviewText);
      themes = rawResult.themes;
      inputTokens = rawResult.inputTokens;
      outputTokens = rawResult.outputTokens;
    } catch (err) {
      llmSuccess = false;
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    const actualCostUsd = resolved.source === 'app'
      ? estimateCost(resolved.providerType, resolved.modelName, inputTokens, outputTokens)
      : 0;

    // Log usage
    const usageLog = await prisma.llmUsageLog.create({
      data: {
        appId,
        providerType: resolved.providerType,
        modelName: resolved.modelName,
        inputTokens,
        outputTokens,
        success: llmSuccess,
        errorMessage: errorMessage ?? null,
        purpose: 'theme_extraction',
      },
    });

    if (!llmSuccess) {
      await prisma.reviewAnalysisRun.update({
        where: { id: run.id },
        data: { status: 'failed', inputTokens, outputTokens, costUsd: 0, llmUsageLogId: usageLog.id },
      });
      return reply.code(502).send({ error: 'llm_error', message: errorMessage });
    }

    // Persist themes
    const created = await prisma.$transaction(
      themes.map(t =>
        prisma.theme.create({
          data: {
            appId,
            label: t.theme,
            frequency: t.frequency,
            examplePhrases: t.examplePhrases.slice(0, 3),
            status: 'pending',
            sourceHash,
          },
        })
      )
    );

    await prisma.reviewAnalysisRun.update({
      where: { id: run.id },
      data: { status: 'completed', inputTokens, outputTokens, costUsd: actualCostUsd, llmUsageLogId: usageLog.id },
    });

    return reply.send({
      themes: created,
      reviewCount,
      filteredCount,
      actualCostUsd,
      inputTokens,
      outputTokens,
    });
  });

  // POST /admin/apps/:appId/themes/:themeId/accept
  app.post('/admin/apps/:appId/themes/:themeId/accept', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, themeId } = request.params as { appId: string; themeId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const theme = await prisma.theme.findFirst({ where: { id: themeId, appId } });
    if (!theme) return reply.code(404).send({ error: 'theme_not_found' });

    const updated = await prisma.theme.update({ where: { id: themeId }, data: { status: 'accepted' } });
    return reply.send({ theme: updated });
  });

  // POST /admin/apps/:appId/themes/:themeId/discard
  app.post('/admin/apps/:appId/themes/:themeId/discard', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, themeId } = request.params as { appId: string; themeId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const theme = await prisma.theme.findFirst({ where: { id: themeId, appId } });
    if (!theme) return reply.code(404).send({ error: 'theme_not_found' });

    const updated = await prisma.theme.update({ where: { id: themeId }, data: { status: 'discarded' } });
    return reply.send({ theme: updated });
  });

  // PATCH /admin/apps/:appId/themes/:themeId — update label
  app.patch('/admin/apps/:appId/themes/:themeId', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId, themeId } = request.params as { appId: string; themeId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const PatchSchema = z.object({ label: z.string().min(1).max(100) });
    const body = PatchSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    const theme = await prisma.theme.findFirst({ where: { id: themeId, appId } });
    if (!theme) return reply.code(404).send({ error: 'theme_not_found' });

    const updated = await prisma.theme.update({ where: { id: themeId }, data: { label: body.data.label } });
    return reply.send({ theme: updated });
  });

  // GET /admin/apps/:appId/store-config — get store URLs
  app.get('/admin/apps/:appId/store-config', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    const appRecord = await assertAppAccess(appId, dev.id);
    if (!appRecord) return reply.code(404).send({ error: 'app_not_found' });
    return reply.send({ appStoreUrl: appRecord.appStoreUrl, playStoreUrl: appRecord.playStoreUrl });
  });

  // PUT /admin/apps/:appId/store-config — save store URLs
  app.put('/admin/apps/:appId/store-config', { preHandler: requireDeveloper }, async (request, reply) => {
    const { appId } = request.params as { appId: string };
    const dev = request.developer!;
    if (!await assertAppAccess(appId, dev.id)) return reply.code(404).send({ error: 'app_not_found' });

    const Schema = z.object({
      appStoreUrl: z.string().url().optional().nullable(),
      playStoreUrl: z.string().url().optional().nullable(),
    });
    const body = Schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_body' });

    const updated = await prisma.app.update({
      where: { id: appId },
      data: { appStoreUrl: body.data.appStoreUrl ?? null, playStoreUrl: body.data.playStoreUrl ?? null },
    });
    return reply.send({ appStoreUrl: updated.appStoreUrl, playStoreUrl: updated.playStoreUrl });
  });
}

// ─── Direct theme extraction call (bypasses provider abstraction) ─────────────

import { createRequire } from 'module';
import type { ResolvedProvider } from '../llm/factory.js';

async function callThemeExtraction(
  resolved: ResolvedProvider,
  reviewText: string,
): Promise<{ themes: ExtractedTheme[]; inputTokens: number; outputTokens: number }> {
  const { apiKey, providerType: providerTypeAlias, modelName, baseUrl } = resolved;
  const providerType = providerTypeAlias;

  if (providerType === 'openai_compatible') {
    const _require = createRequire(import.meta.url);
    const OpenAI = _require('openai');
    const client = new OpenAI.default({ apiKey, baseURL: baseUrl || undefined });
    const resp = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: THEME_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: reviewText },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });
    const raw = resp.choices[0]?.message?.content ?? '[]';
    return {
      themes: parseThemesResponse(raw),
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
    };
  }

  if (providerType === 'anthropic') {
    const _require = createRequire(import.meta.url);
    const Anthropic = _require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey });
    const resp = await client.messages.create({
      model: modelName,
      max_tokens: 2048,
      system: THEME_EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: reviewText }],
    });
    const raw = resp.content[0]?.type === 'text' ? resp.content[0].text : '[]';
    return {
      themes: parseThemesResponse(raw),
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
    };
  }

  if (providerType === 'gemini') {
    const _require = createRequire(import.meta.url);
    const { GoogleGenerativeAI } = _require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: THEME_EXTRACTION_SYSTEM_PROMPT,
    });
    const result = await geminiModel.generateContent(reviewText);
    const raw = result.response.text();
    const usage = result.response.usageMetadata;
    return {
      themes: parseThemesResponse(raw),
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  }

  throw new Error(`Unsupported provider: ${providerType}`);
}
