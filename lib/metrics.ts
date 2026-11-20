import { TYPE_CATALOG } from "./agent-types.ts";

/**
 * metrics.ts — the shapes and arithmetic behind /metrics, apart from any
 * network call so they can be tested (relative imports on purpose: the test
 * runner does not know the "@/" alias).
 *
 * Every number here arrives already aggregated from metrics_overview()
 * (migration 0033). Nothing in this file ever sees a customer's email, project
 * name or message — that is the database's rule, not this file's courtesy.
 */

export interface DayPoint {
  d: string;
  accounts: number;
  projects: number;
  messages: number;
  docs: number;
  active: number;
}

/** A breakdown row. `n` is null when the group is under min_group (hidden in the database). */
export interface Group { n: number | null; small?: boolean }

export interface MetricsOverview {
  generated_at: string;
  days: number;
  include_team: boolean;
  min_group: number;
  totals: {
    accounts: number; accounts_in_range: number;
    projects: number; projects_in_range: number;
    messages_in_range: number;
    docs: number; docs_in_range: number;
    active_7: number; active_30: number; returning_30: number;
  };
  funnel: { accounts: number; with_project: number; with_message: number; with_doc: number };
  series: DayPoint[];
  consultant_types: (Group & { tagline: string })[];
  plans: (Group & { plan: string })[];
  beta_keys: { keys: number; seats_used: number; seats_total: number };
  cost: {
    month_micro_usd: number;
    last_month_micro_usd: number;
    free_pool_micro_usd: number;
    requests_month: number;
    by_month: { month: string; micro_usd: number }[];
  };
}

export interface AccessLogRow { at: string; who: string | null; what: string; outcome: "ok" | "not_viewer" | "mfa_required" }

export const RANGES = [7, 30, 90] as const;

/** Micro-dollars to a short dollar string: 1_234_560 -> "$1.23", 512_000_000 -> "$512". */
export function usd(micro: number): string {
  const n = (micro || 0) / 1_000_000;
  if (n === 0) return "$0";
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString("en")}`;
}

/** Whole percent of part in whole; "–" when there is no whole. */
export function pct(part: number, whole: number): string {
  if (!whole) return "–";
  return `${Math.round((part / whole) * 100)}%`;
}

/** A hidden group reads "< 5", never 0 — zero would be a lie. */
export function groupCount(g: Group, minGroup: number): string {
  return g.n == null ? `< ${minGroup}` : g.n.toLocaleString("en");
}

/**
 * The consultant type's name from the agent's tagline (stored lower-cased by
 * the database). Same match as templateFor() in agent-types.ts.
 */
export function typeLabel(tagline: string): string {
  const t = TYPE_CATALOG.consultant.find(x => x.sub.toLowerCase() === tagline.trim().toLowerCase());
  return t ? t.type : "Other / older agents";
}

/**
 * Rows that end up with the same label (several old taglines all read
 * "Other / older agents") become one. A hidden part stays hidden: its count is
 * not known here, so the row reads as the known sum plus a "+" — or stays hidden
 * when every part was.
 */
export function mergeGroups(rows: { label: string; g: Group }[]): { label: string; g: Group; plus: boolean }[] {
  const parts = new Map<string, Group[]>();
  for (const { label, g } of rows) parts.set(label, [...(parts.get(label) ?? []), g]);
  return [...parts].map(([label, gs]) => {
    const known = gs.reduce((s, g) => s + (g.n ?? 0), 0);
    const hidden = gs.some(g => g.n == null);
    return known > 0
      ? { label, g: { n: known }, plus: hidden }
      : { label, g: { n: null, small: true }, plus: false };
  }).sort((a, b) => (b.g.n ?? 0) - (a.g.n ?? 0));
}

/** Sum of one field over the series. */
export function total(series: DayPoint[], key: keyof Omit<DayPoint, "d">): number {
  return series.reduce((s, p) => s + (p[key] || 0), 0);
}

/** "2026-11-19" -> "19 Nov". */
export function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "2026-11-01" -> "Nov 26". */
export function shortMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

/** Idle time after which the page hides the numbers again. */
export const IDLE_HIDE_MS = 15 * 60 * 1000;
