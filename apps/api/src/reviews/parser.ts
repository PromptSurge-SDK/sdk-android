/**
 * Parse pasted app store review text into structured records.
 *
 * Supported formats:
 *   1. `\n\n`-separated blocks  (each paragraph = one review)
 *   2. Single `\n`-separated lines (each non-empty line = one review)
 *
 * Optional leading star rating prefixes (stripped from text):
 *   - `5★` / `5*` / `5/5` / `5 stars` / `(5)` — at the very start of a line/block.
 */

export interface ParsedReview {
  rating?: number; // 1–5 if detected, undefined otherwise
  text: string;
}

// Matches optional star rating at the start: "5★", "5*", "5/5", "5 stars", "(5)"
const RATING_PREFIX_RE = /^\s*(?:\((\d)\)|(\d)[★*]|(\d)\/5|(\d)\s+stars?)\s*/i;

function parseRating(raw: string): { rating?: number; text: string } {
  const m = RATING_PREFIX_RE.exec(raw);
  if (!m) return { text: raw.trim() };
  const n = Number(m[1] ?? m[2] ?? m[3] ?? m[4]);
  const rating = n >= 1 && n <= 5 ? n : undefined;
  const text = raw.slice(m[0].length).trim();
  return { rating, text };
}

export function parseReviews(input: string): ParsedReview[] {
  if (!input || !input.trim()) return [];

  // Try paragraph split first (double newline)
  const blocks = input.split(/\n{2,}/);
  const segments = blocks.length > 1
    ? blocks.map(b => b.trim()).filter(Boolean)
    : input.split(/\n/).map(l => l.trim()).filter(Boolean);

  return segments.map(parseRating);
}

/** Filter to 4★+ reviews. Returns filtered list + counts. */
export function filterHighRated(reviews: ParsedReview[]): {
  filtered: ParsedReview[];
  reviewCount: number;
  filteredCount: number;
} {
  const reviewCount = reviews.length;
  const hasRatings = reviews.some(r => r.rating !== undefined);

  // If no ratings at all, treat all as passing
  const filtered = hasRatings
    ? reviews.filter(r => r.rating === undefined || r.rating >= 4)
    : reviews;

  return { filtered, reviewCount, filteredCount: filtered.length };
}
