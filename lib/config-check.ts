import "server-only";

/**
 * config-check.ts — says out loud what is missing, once, at boot.
 *
 * The dangerous one is SUPABASE_SERVICE_ROLE_KEY. Without it the app does not
 * break: lib/entitlement-server.ts returns null, every account reads as the
 * free plan, and nothing is ever written to agxp_usage. A deployment with no
 * plans and no metering is indistinguishable from a working free tier, and it
 * stays that way until someone thinks to count the rows. So it is named here
 * at startup instead, in the log the person who can fix it already reads.
 *
 * Nothing here reads a value — only whether one is set. A check that printed
 * a key would be worse than the problem it reports.
 */

export interface ConfigFinding {
  key: string;
  /** "fatal" = the feature does not work at all. "silent" = it fails quietly. */
  level: "fatal" | "silent" | "optional";
  consequence: string;
}

const SPEC: ConfigFinding[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    level: "fatal",
    consequence: "No database and no sign-in. Nothing works.",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    level: "fatal",
    consequence: "No database and no sign-in. Nothing works.",
  },
  {
    key: "ANTHROPIC_API_KEY",
    level: "fatal",
    consequence: "Every message fails with \"The assistant isn't configured\".",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    level: "silent",
    consequence:
      "Plans and metering are inert: every account reads as free, agxp_usage stays empty, " +
      "beta keys cannot be redeemed. Nothing errors — it just looks like a working free tier.",
  },
  {
    key: "NEXT_PUBLIC_SENTRY_DSN",
    level: "optional",
    consequence: "No error reports from production. Sentry is wired but has nowhere to send.",
  },
];

/** Every variable that is not set, with what its absence costs. */
export function missingConfig(): ConfigFinding[] {
  return SPEC.filter(f => !process.env[f.key]);
}

/** Which keys are set — booleans only, safe to send to a team-only UI. */
export function configPresence(): Record<string, boolean> {
  return Object.fromEntries(SPEC.map(f => [f.key, !!process.env[f.key]]));
}

/**
 * Called once from instrumentation.ts. Prints nothing when everything is set,
 * so a healthy boot stays quiet and a broken one cannot be scrolled past.
 */
export function reportConfig(): void {
  const missing = missingConfig();
  if (!missing.length) return;

  const worst = missing.some(m => m.level === "fatal") ? "error" : "warn";
  const lines = missing.map(m => `  ${m.key} (${m.level}) — ${m.consequence}`);
  console[worst](
    `[config] ${missing.length} environment variable${missing.length > 1 ? "s are" : " is"} not set:\n` +
      lines.join("\n"),
  );
}
