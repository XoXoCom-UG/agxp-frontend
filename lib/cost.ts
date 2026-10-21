/**
 * cost.ts — what a request cost, in money rather than tokens.
 *
 * Limits used to be counted in "tokens in + out". With prompt caching on, most
 * of the input arrives as cache reads and cache writes, which the API reports
 * in separate fields — so the counter missed most of what we were billed for
 * and the ceiling almost never bit. Money is also the unit the budget was set
 * in (Patryk, 2026-10-16: 3,000–5,000 € a month, and it has to be watertight).
 *
 * Every request is priced at Claude Sonnet 5's rates, including the title
 * route's Haiku calls. Over-counting a cheap call is the safe direction for a
 * cap; under-counting is not.
 *
 * Kept in millionths of a dollar so it stays an integer all the way into a
 * bigint column — no float rounding drift across millions of additions.
 */

/** USD per million tokens, Claude Sonnet 5 (checked 2026-10-17). */
export const PRICE_PER_MTOK = {
  input: 2.0,
  output: 10.0,
  /** 5-minute cache write: 1.25× input. */
  cacheWrite: 2.5,
  /** Cache read: 0.1× input. */
  cacheRead: 0.2,
} as const;

export interface UsageTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Cost in micro-USD. A price per million tokens times a token count is
 * already micro-dollars, so no conversion factor is needed.
 */
export function costMicroUsd(t: UsageTokens): number {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return Math.ceil(
    n(t.input) * PRICE_PER_MTOK.input +
    n(t.output) * PRICE_PER_MTOK.output +
    n(t.cacheWrite) * PRICE_PER_MTOK.cacheWrite +
    n(t.cacheRead) * PRICE_PER_MTOK.cacheRead,
  );
}

export const usd = (dollars: number) => Math.round(dollars * 1_000_000);

/**
 * What a call is reserved at before it runs (begin_ai_call, migration 0021):
 * the worst case, so parallel calls cannot all start from the same "spent".
 *
 * Input is priced as if nothing were cached and output as if the cap were
 * reached — both over-count, which is the safe direction. The real cost
 * replaces this the moment the call is settled.
 */
export function reserveMicroUsd(inputTokens: number, maxOutputTokens: number): number {
  return costMicroUsd({ input: inputTokens, output: maxOutputTokens, cacheRead: 0, cacheWrite: 0 });
}

/** A rough upper estimate of tokens, from what the request carries. */
export interface InputSize {
  /** Characters of text: system prompt, messages, inlined files. */
  chars: number;
  /** Raw bytes of attached PDFs. */
  pdfBytes?: number;
  /** How many images are attached. */
  images?: number;
}

/**
 * Text: about three characters a token, fewer for German compounds, so /3 is
 * already generous. PDFs: Claude reads each page as text plus an image, a few
 * thousand tokens a page; a page is rarely under 30 KB, so a token per 10
 * bytes stays above that. Images: the API caps one at about 1,600 tokens.
 */
export function estimateInputTokens(s: InputSize): number {
  const n = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);
  return Math.ceil(n(s.chars) / 3 + n(s.pdfBytes) / 10 + n(s.images) * 1_600);
}
