import type { LlmProviderConfig } from '@prisma/client';
import type { LlmProvider } from './interface.js';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { decryptApiKey } from '../crypto/index.js';

export interface ResolvedProvider {
  provider: LlmProvider;
  /** 'app' = user-supplied key, 'platform' = PromptSurge default */
  source: 'app' | 'platform';
  providerType: string;
  modelName: string;
  apiKey: string;
  baseUrl: string | null;
}

function buildProvider(providerType: string, modelName: string, apiKey: string, baseUrl: string): LlmProvider {
  switch (providerType) {
    case 'openai_compatible':
      return new OpenAiCompatibleProvider(apiKey, modelName, baseUrl);
    case 'anthropic':
      return new AnthropicProvider(apiKey, modelName);
    case 'gemini':
      return new GeminiProvider(apiKey, modelName);
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

/** Use when you already have a Prisma LlmProviderConfig row (legacy path). */
export async function getProvider(config: LlmProviderConfig): Promise<LlmProvider> {
  const apiKey = await decryptApiKey(Buffer.from(config.encryptedApiKey));
  return buildProvider(config.providerType, config.modelName, apiKey, config.baseUrl ?? '');
}

/**
 * Resolve the LLM provider for an app.
 * Priority: app-level config → platform default (env vars).
 * Returns null only if neither is configured.
 */
export async function resolveProvider(appConfig: LlmProviderConfig | null): Promise<ResolvedProvider | null> {
  if (appConfig) {
    const apiKey = await decryptApiKey(Buffer.from(appConfig.encryptedApiKey));
    return {
      provider: buildProvider(appConfig.providerType, appConfig.modelName, apiKey, appConfig.baseUrl ?? ''),
      source: 'app',
      providerType: appConfig.providerType,
      modelName: appConfig.modelName,
      apiKey,
      baseUrl: appConfig.baseUrl,
    };
  }

  const providerType = process.env.DEFAULT_LLM_PROVIDER;
  const modelName = process.env.DEFAULT_LLM_MODEL;
  const apiKey = process.env.DEFAULT_LLM_KEY;
  if (!providerType || !modelName || !apiKey) return null;

  const baseUrl = process.env.DEFAULT_LLM_BASE_URL ?? null;
  return {
    provider: buildProvider(providerType, modelName, apiKey, baseUrl ?? ''),
    source: 'platform',
    providerType,
    modelName,
    apiKey,
    baseUrl,
  };
}
