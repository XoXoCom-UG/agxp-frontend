/**
 * Where to go after signing in: the app page the proxy sent someone away
 * from (`/login?next=/dashboard/project/…`), so a link to a project still
 * lands on the project once they are in.
 *
 * Only a path inside the app is honoured. Anything else — another site,
 * `//evil.example`, a `\` that some browsers read as `/`, a bare `/login` —
 * falls back to the dashboard: an open redirect on the sign-in page is a
 * phishing tool.
 */
export function safeNext(raw: string | null | undefined): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  if (!/^\/dashboard(?:[/?#]|$)/.test(raw)) return fallback;
  if (/[\\\s]|\/\//.test(raw)) return fallback;
  return raw;
}

/** The `next` of the current address, made safe. Browser only. */
export function nextFromLocation(): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"));
}
