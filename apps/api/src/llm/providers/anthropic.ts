import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, GeneratePromptsOpts, GeneratePromptsResult, TestConnectionResult, GeneratedPrompt } from '../interface.js';
import { PRE_PROMPT_GENERATION_TEMPLATE as SYSTEM_PROMPT_TEMPLATE } from '../system-prompts.js';

function buildSystemPrompt(opts: GeneratePromptsOpts): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{{count}}', String(opts.count))
    .replace('{{locale}}', opts.locale)
    .replace('{{positive_keywords}}', opts.positiveKeywords.join(', ') || 'none')
    .replace('{{negative_keywords}}', opts.negativeKeywords.join(', ') || 'none')
    .replace('{{count}}', String(opts.count));
}

function parseResponse(raw: string): GeneratedPrompt[] {
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed)) throw new Error('LLM response is not an array');
  return parsed as GeneratedPrompt[];
}

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generatePrompts(opts: GeneratePromptsOpts): Promise<GeneratePromptsResult> {
    const systemPrompt = buildSystemPrompt(opts);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Generate ${opts.count} pre-prompt suggestions for locale: ${opts.locale}` },
      ],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const prompts = parseResponse(raw);
    return {
      prompts,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
