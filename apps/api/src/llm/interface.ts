export interface GeneratePromptsOpts {
  positiveKeywords: string[];
  negativeKeywords: string[];
  locale: string;
  count: number;
}

export interface GeneratedPrompt {
  title: string;
  body: string;
  ctaConfirm: string;
  ctaDismiss: string;
}

export interface GeneratePromptsResult {
  prompts: GeneratedPrompt[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
}

export interface LlmProvider {
  testConnection(): Promise<TestConnectionResult>;
  generatePrompts(opts: GeneratePromptsOpts): Promise<GeneratePromptsResult>;
}
