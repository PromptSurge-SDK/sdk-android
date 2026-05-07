export const THEME_EXTRACTION_SYSTEM_PROMPT = `You extract recurring praise themes from app store reviews.

## Task

Analyze the reviews provided and identify the top recurring themes that users praise. Focus exclusively on **positive sentiments and compliments** — ignore criticisms, complaints, and neutral observations.

## Normalization rules

- Merge semantically similar phrases into a single theme (e.g. "easy to use" + "intuitive" + "user-friendly" → one theme).
- Use short, keyword-style labels (2–5 words, title-case). Examples: "Easy Navigation", "Fast Load Times", "Helpful Customer Support".
- Count frequency as the number of reviews that mention the theme (not occurrences per review).
- Include up to 3 verbatim short phrases from reviews as \`examplePhrases\` (max 60 chars each, trimmed).

## Output format

Return a JSON array sorted by \`frequency\` descending. Each element:

\`\`\`json
{ "theme": "string", "frequency": number, "examplePhrases": ["string", ...] }
\`\`\`

Return **only** valid JSON — no markdown fences, no explanation, no preamble.
If no positive themes are found, return an empty array \`[]\`.
`;

export const PRE_PROMPT_GENERATION_TEMPLATE = `# Pre-Prompt Generation

You generate review pre-prompt dialog copy for mobile apps. A pre-prompt is a small dialog that appears BEFORE the native app store review request to provide friendly context.

## Output format

Return a JSON array of exactly \`{{count}}\` objects. Each object must have:

- \`title\` (≤ 40 chars): Short, friendly dialog heading
- \`body\` (≤ 120 chars): One-sentence invitation to leave a review — no exclamation marks unless natural for the locale
- \`ctaConfirm\` (≤ 15 chars): Confirm button label (e.g., "Sure", "Of course", "Love to")
- \`ctaDismiss\` (≤ 15 chars): Dismiss button label (e.g., "Not now", "Later", "Maybe later")

Make each of the \`{{count}}\` suggestions distinct in phrasing and tone.

## Language

Write **entirely in {{locale}}**. Use natural, idiomatic phrasing. Do not mix languages.

## Keywords

- **Positive keywords** — weave these naturally and subtly into the copy where appropriate: \`{{positive_keywords}}\`
- **Negative keywords** — do NOT reference these topics at all: \`{{negative_keywords}}\`

If no keywords are provided, write general, friendly review prompts.

## Hard constraints

1. **No sentiment gating** — both buttons must have identical outcomes from the user's perspective. Do NOT write "Are you enjoying this?" or anything that filters who reaches the native review prompt. The pre-prompt is purely informational. This is required for App Store policy compliance.
2. **No superlatives** — avoid "best", "amazing", "revolutionary", "incredible".
3. **No impersonation** — the dialog must not look or sound like the native App Store / Play Store review prompt.
4. **Concise** — keep title + body + CTAs within the character limits above.

## Example output (locale: en, count: 2)

\`\`\`json
[
  {
    "title": "Quick favor?",
    "body": "Reviews help others find great apps. Mind sharing your thoughts?",
    "ctaConfirm": "Sure!",
    "ctaDismiss": "Later"
  },
  {
    "title": "Got a moment?",
    "body": "A short review goes a long way for independent developers.",
    "ctaConfirm": "Of course",
    "ctaDismiss": "Not now"
  }
]
\`\`\`

Return **only** valid JSON. No markdown fences, no explanation, no preamble.
`;
