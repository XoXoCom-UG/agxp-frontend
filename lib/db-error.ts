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

export function describeDbError(e: unknown, what = "The write"): string {
  const err = (e ?? {}) as PgError;
  const base = err.message || "Unknown database error.";
  const extra = [err.details, err.hint].filter(Boolean).join(" — ");

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
    case "PGRST301":
      return "Your session expired — please sign in again.";
    default:
      break;
  }

  const code = err.code ? `[${err.code}] ` : "";
  return `${code}${what} failed: ${base}${extra ? ` — ${extra}` : ""}`;
}
