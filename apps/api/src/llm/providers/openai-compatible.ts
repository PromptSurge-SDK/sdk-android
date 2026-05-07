import OpenAI from 'openai';
import type { LlmProvider, GeneratePromptsOpts, GeneratePromptsResult, TestConnectionResult, GeneratedPrompt } from '../interface.js';
import { PRE_PROMPT_GENERATION_TEMPLATE as SYSTEM_PROMPT_TEMPLATE } from '../system-prompts.js';

function buildSystemPrompt(opts: GeneratePromptsOpts): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{{count}}', String(opts.count))
    .replace('{{locale}}', opts.locale)
    .replace('{{positive_keywords}}', opts.positiveKeywords.join(', ') || 'none')
    .replace('{{negative_keywords}}', opts.negativeKeywords.join(', ') || 'none')
    // second occurrence of {{count}} in the example section
    .replace('{{count}}', String(opts.count));
}

function parseResponse(raw: string): GeneratedPrompt[] {
  // Strip markdown fences if the model wrapped in ```json ... ```
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed)) throw new Error('LLM response is not an array');
  return parsed as GeneratedPrompt[];
}

export class OpenAiCompatibleProvider implements LlmProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseURL || undefined });
    this.model = model;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generatePrompts(opts: GeneratePromptsOpts): Promise<GeneratePromptsResult> {
    const systemPrompt = buildSystemPrompt(opts);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate ${opts.count} pre-prompt suggestions for locale: ${opts.locale}` },
      ],
      max_tokens: 1024,
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const prompts = parseResponse(raw);
    return {
      prompts,
      usage: {
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      },
    };
  }
}
