import { GoogleGenerativeAI } from '@google/generative-ai';
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

export class GeminiProvider implements LlmProvider {
  private genAI: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const m = this.genAI.getGenerativeModel({ model: this.model });
      await m.generateContent('ping');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async generatePrompts(opts: GeneratePromptsOpts): Promise<GeneratePromptsResult> {
    const systemPrompt = buildSystemPrompt(opts);
    const m = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
    });
    const result = await m.generateContent(
      `Generate ${opts.count} pre-prompt suggestions for locale: ${opts.locale}`,
    );
    const raw = result.response.text();
    const prompts = parseResponse(raw);

    const usage = result.response.usageMetadata;
    return {
      prompts,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
    };
  }
}
