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
