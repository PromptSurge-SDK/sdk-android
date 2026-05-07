export interface ModelOption {
  id: string;
  label: string;
  /** Pre-filled base URL for openai_compatible entries; empty for anthropic/gemini. */
  baseUrl: string;
  isDefault?: boolean;
}

export interface ProviderEntry {
  label: string;
  models: ModelOption[];
}

export const PROVIDERS: Record<string, ProviderEntry> = {
  openai_compatible: {
    label: 'OpenAI-compatible (DeepSeek, OpenAI, Together, Groq, OpenRouter, self-hosted)',
    models: [
      { id: 'deepseek-v4-flash',                          label: 'DeepSeek V4 Flash (recommended — cheapest)',   baseUrl: 'https://api.deepseek.com/v1',        isDefault: true },
      { id: 'deepseek-chat',                              label: 'DeepSeek Chat',                                 baseUrl: 'https://api.deepseek.com/v1' },
      { id: 'gpt-4o-mini',                                label: 'GPT-4o mini (OpenAI)',                          baseUrl: 'https://api.openai.com/v1' },
      { id: 'gpt-4o',                                     label: 'GPT-4o (OpenAI)',                               baseUrl: 'https://api.openai.com/v1' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',   label: 'Llama 3.3 70B Turbo (Together AI)',             baseUrl: 'https://api.together.xyz/v1' },
      { id: 'llama-3.1-8b-instant',                       label: 'Llama 3.1 8B Instant (Groq)',                   baseUrl: 'https://api.groq.com/openai/v1' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3',        label: 'Mistral 7B (OpenRouter)',                        baseUrl: 'https://openrouter.ai/api/v1' },
    ],
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    models: [
      { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5 (fast, cheap)',        baseUrl: '', isDefault: true },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (higher quality)',     baseUrl: '' },
    ],
  },
  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (fastest)',  baseUrl: '', isDefault: true },
      { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',                 baseUrl: '' },
    ],
  },
};
