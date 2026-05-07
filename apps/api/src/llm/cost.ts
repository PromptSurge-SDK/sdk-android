/**
 * Cost estimation for LLM calls.
 *
 * Prices are hardcoded at the time of M6.5 (May 2026).
 * These go stale as providers update pricing — revisit quarterly.
 *
 * All prices in USD per 1M tokens.
 */

import type { LlmProviderType } from '@prisma/client';

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

/** Prices USD per 1M tokens as of May 2026. */
const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4-turbo': { inputPerMillion: 10, outputPerMillion: 30 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },
  // DeepSeek (default openai_compatible)
  'deepseek-v4-flash': { inputPerMillion: 0.07, outputPerMillion: 0.28 },
  'deepseek-chat': { inputPerMillion: 0.27, outputPerMillion: 1.1 },
  'deepseek-reasoner': { inputPerMillion: 0.55, outputPerMillion: 2.19 },
  // Anthropic
  'claude-opus-4-5': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-sonnet-4-5': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku-4-5': { inputPerMillion: 0.8, outputPerMillion: 4 },
  // Gemini
  'gemini-2.5-pro': { inputPerMillion: 1.25, outputPerMillion: 10 },
  'gemini-2.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

const PROVIDER_DEFAULTS: Record<LlmProviderType, ModelPricing> = {
  openai_compatible: { inputPerMillion: 1, outputPerMillion: 4 },
  anthropic: { inputPerMillion: 3, outputPerMillion: 15 },
  gemini: { inputPerMillion: 0.5, outputPerMillion: 2 },
};

function getPricing(providerType: LlmProviderType, modelName: string): ModelPricing {
  return PRICING[modelName] ?? PROVIDER_DEFAULTS[providerType];
}

/** Estimate cost of a single LLM call in USD. */
export function estimateCost(
  providerType: LlmProviderType,
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = getPricing(providerType, modelName);
  return (inputTokens / 1_000_000) * p.inputPerMillion
    + (outputTokens / 1_000_000) * p.outputPerMillion;
}

/**
 * Rough token count estimate from character count.
 * 1 token ≈ 4 chars for English; conservative 3 chars for multilingual.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
