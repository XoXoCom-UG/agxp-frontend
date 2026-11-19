/**
 * db-error.ts — turns a Supabase/PostgREST error into something that tells us
 * what to actually do about it.
 *
 * Why this exists: "Create Agent" failed for days with the bare Postgres text
 * `new row violates row-level security policy for table "agents"`, which does
 * not say WHICH policy is missing or how to fix it. The Postgres error code is
 * the useful part, so it always ends up on screen now.
 */

interface PgError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

const FIX_SCRIPT = "supabase/fix_create_agent.sql";

/**
 * What the person reads when the request never reached the database. It is
 * the English key of a German translation (lib/i18n.ts), so the screens put
 * it through tr() like their own words.
 */
export const NETWORK_ERROR = "The connection to the server dropped. Check your internet connection and try again.";

/** The browser could not send the request at all: offline, a dropped
 *  connection, a blocked request. Chrome, Safari and Firefox each word it
 *  differently, and supabase-js passes their text on as the message. */
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: unknown } | null)?.message ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(msg);
}

/** A stack trace is for the console, never for the screen. supabase-js puts
 *  the browser's whole stack in `details` when a request fails. */
function looksLikeStack(s: string): boolean {
  return /\n\s*at |\bat .+\(.+:\d+:\d+\)/.test(s);
}

export function describeDbError(e: unknown, what = "The write"): string {
  const err = (e ?? {}) as PgError;
  // Tested with a dropped request (2026-11-19): the screen showed
  // "TypeError: Failed to fetch at window.fetch (<anonymous>:9:11) at …",
  // the whole stack, and nothing a person could do with it.
  if (isNetworkError(e)) {
    console.warn(`[db] ${what} failed:`, e);
    return NETWORK_ERROR;
  }
  const base = err.message || "Unknown database error.";
  const extra = [err.details, err.hint].filter(s => s && !looksLikeStack(s)).join(" — ");

  // A plan limit is not a fault, and it already carries a sentence written
  // for the person who hit it. Passing it through here means every call site
  // shows it properly without knowing plans exist — wrapping it in
  // "Row-Level Security blocked this insert" would be both wrong and
  // frightening. P0001 is the same thing raised by the quota trigger.
  if ((e as { name?: string })?.name === "QuotaError") return base;
  if (err.code === "P0001") return base;

  switch (err.code) {
    // insufficient_privilege — the row was rejected by RLS
    case "42501":
      return `[42501] Row-Level Security blocked this insert. The database is missing the INSERT policy — run ${FIX_SCRIPT} in the Supabase SQL Editor, then try again. (${base})`;
    // undefined_column — schema drift, e.g. created_by never got added
    case "42703":
      return `[42703] A column is missing in the database: ${base}. Run ${FIX_SCRIPT} in the Supabase SQL Editor.`;
    // undefined_table
    case "42P01":
      return `[42P01] A table is missing in the database: ${base}. The migrations in supabase/migrations were not applied to this project.`;
    case "23502":
      return `[23502] A required field was empty: ${base}`;
    case "23503":
      return `[23503] A referenced row does not exist: ${base}`;
    case "23505":
      return `[23505] That already exists: ${base}`;
    // Our own code (lib/agents.ts setAgentArchived): the archive column or
    // the update policy is missing, or RLS filtered the row out — which
    // Postgres reports as success.
    case "AGXP_ARCHIVE_DENIED":
      return "The database did not allow archiving this agent. Either it was not created by you, or archiving is not set up yet — run supabase/migrations/0006_agents_archive.sql once in the Supabase SQL Editor, then try again.";
    case "PGRST301":
      return "Your session expired — please sign in again.";
    default:
      break;
  }

  const code = err.code ? `[${err.code}] ` : "";
  return `${code}${what} failed: ${base}${extra ? ` — ${extra}` : ""}`;
}
