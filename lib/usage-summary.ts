import { costMicroUsd } from "./cost.ts";

/**
 * usage-summary.ts — the arithmetic behind the team's usage panel, apart from
 * the database call, so it can be tested without a session (relative imports
 * on purpose: the test runner does not know the "@/" alias).
 */

export interface UserUsage {
  userId: string;
  email: string;
  plan: string | null;
  tokens: number;
  requests: number;
  /** What those tokens cost, in USD (lib/cost.ts). */
  usd: number;
}

export interface TeamUsage {
  /** First day of the month this covers, e.g. "2026-10-01". */
  month: string;
  users: UserUsage[];
  totalUsd: number;
  totalTokens: number;
  totalRequests: number;
}

export interface UsageRow {
  user_id: string;
  email: string | null;
  plan: string | null;
  period_start: string;
  input_tokens: number | string;
  output_tokens: number | string;
  cache_read_tokens: number | string;
  cache_write_tokens: number | string;
  requests: number;
  /** What the API calls cost, in millionths of a dollar, as lib/cost.ts priced them when they ran. */
  cost_micro_usd?: number | string | null;
}

/** Folds the rows of one month into one line per account, biggest spender first. */
export function summarise(rows: UsageRow[], month: string): TeamUsage {
  const by = new Map<string, UserUsage>();
  for (const r of rows) {
    if (r.period_start < month) continue;
    const input = Number(r.input_tokens), output = Number(r.output_tokens);
    // The stored cost is what each request was priced at when it ran. A row
    // from before that column existed has none, so it is priced from its tokens.
    const stored = Number(r.cost_micro_usd ?? 0);
    const micro = stored > 0 ? stored : costMicroUsd({
      input, output, cacheRead: Number(r.cache_read_tokens), cacheWrite: Number(r.cache_write_tokens),
    });
    const u = by.get(r.user_id) ?? { userId: r.user_id, email: r.email ?? "(no address)", plan: r.plan, tokens: 0, requests: 0, usd: 0 };
    u.tokens += input + output;
    u.requests += r.requests;
    u.usd += micro / 1_000_000;
    by.set(r.user_id, u);
  }
  const users = [...by.values()].sort((a, b) => b.usd - a.usd);
  const totalUsd = users.reduce((n, u) => n + u.usd, 0);
  return {
    month,
    users,
    totalUsd,
    totalTokens: users.reduce((n, u) => n + u.tokens, 0),
    totalRequests: users.reduce((n, u) => n + u.requests, 0),
  };
}

