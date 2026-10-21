/**
 * Agent memory — the Lernnotizen. Its own module because the chat route reads
 * it on the server, and lib/consent.ts carries browser-only Sentry code.
 *
 * Not a cookie: it is a choice about how the service treats what you told it,
 * so it lives on the account (auth user metadata) and follows you to every
 * device. A person may write their own metadata, which is fine here — it is
 * their own preference and grants nothing.
 *
 * On by default, because remembering earlier projects is part of what the
 * agent is for, and switchable off at any time (a right to object, Art. 21
 * DSGVO). Whether this needs opt-in consent instead is open with the lawyer —
 * flipping the default is the line below.
 */
export const MEMORY_DEFAULT_ON = true;

export function memoryAllowed(meta: Record<string, unknown> | null | undefined): boolean {
  const v = meta?.agent_memory;
  return typeof v === "boolean" ? v : MEMORY_DEFAULT_ON;
}
