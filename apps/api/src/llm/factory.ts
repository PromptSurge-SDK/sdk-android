import type { LlmProviderConfig } from '@prisma/client';
import type { LlmProvider } from './interface.js';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { GeminiProvider } from './providers/gemini.js';
import { decryptApiKey } from '../crypto/index.js';

export async function getProvider(config: LlmProviderConfig): Promise<LlmProvider> {
  const apiKey = await decryptApiKey(Buffer.from(config.encryptedApiKey));
  switch (config.providerType) {
    case 'openai_compatible':
      return new OpenAiCompatibleProvider(apiKey, config.modelName, config.baseUrl ?? '');
    case 'anthropic':
      return new AnthropicProvider(apiKey, config.modelName);
    case 'gemini':
      return new GeminiProvider(apiKey, config.modelName);
    default:
      throw new Error(`Unknown provider type: ${config.providerType}`);
  }
}
