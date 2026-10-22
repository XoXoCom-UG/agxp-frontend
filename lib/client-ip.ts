/**
 * client-ip.ts — who is knocking, as far as the network says, and a counter to
 * keep one network from knocking forever.
 *
 * Pure, with no server-only import, so the awkward parts (an IPv6 address has
 * many spellings; a forwarded header can hold a list) are tested without a
 * request. The part that talks to the database is lib/ip-gate.ts.
 *
 * THE ASSUMPTION, written down because the limit is only as good as it:
 * the address comes from `x-real-ip`, else the first entry of `x-forwarded-for`.
 * Behind Vercel (or Cloudflare) the platform sets both itself and overwrites
 * anything the client sent. Reached directly, with no proxy in front, a caller
 * could write those headers and pick their own bucket — which only helps them
 * dodge THIS limit; the per-account ceilings and the budget do not look at the
 * address at all.
 */

export interface HeaderReader { get(name: string): string | null }

function v4(s: string): string | null {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every(n => n >= 0 && n <= 255) ? parts.join(".") : null;
}

/** The eight 16-bit groups of an IPv6 address, or null if it is not one. */
function v6Groups(raw: string): number[] | null {
  let s = raw.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  if (!s.includes(":")) return null;

  // An embedded IPv4 tail (::ffff:1.2.3.4) is two groups.
  const tail = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tail) {
    const q = v4(tail[2]);
    if (!q) return null;
    const [a, b, c, d] = q.split(".").map(Number);
    s = `${tail[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === "" ? [] : part.split(":"));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  if (groups.length !== 8 || !groups.every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map(g => parseInt(g, 16));
}

/** A well-formed address in either family, or null. */
export function parseIp(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return v4(t) ?? (v6Groups(t) ? t : null);
}

/**
 * The caller's address, or null when no header carries a usable one (local
 * development, a test). Null means "cannot limit", never "limit everyone
 * without an address together".
 */
export function clientIp(h: HeaderReader): string | null {
  const real = parseIp(h.get("x-real-ip") ?? "");
  if (real) return real;
  const first = (h.get("x-forwarded-for") ?? "").split(",")[0] ?? "";
  return parseIp(first);
}

/**
 * What one "network" is. An IPv4 address is one; for IPv6 it is the /64, the
 * block a single home or office is handed — otherwise one person holding a /64
 * would have 2^64 addresses to rotate through and the limit would never bite.
 * An IPv4-mapped IPv6 address is the IPv4 address it wraps.
 */
export function ipKey(ip: string): string {
  const plain = v4(ip);
  if (plain) return plain;
  const g = v6Groups(ip);
  if (!g) return ip.toLowerCase();
  // ::ffff:a.b.c.d
  if (g.slice(0, 5).every(n => n === 0) && g[5] === 0xffff) {
    return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  }
  return `v6:${g.slice(0, 4).map(n => n.toString(16)).join(":")}`;
}

/**
 * A fixed-window counter in memory: one instance's cheap first filter, in
 * front of the shared count in the database. It cannot see other instances —
 * that is exactly what the database half is for — but it stops a flood from
 * costing a database round trip per request.
 */
export class WindowCounter {
  private seen = new Map<string, { start: number; hits: number }>();
  private windowMs: number;
  private max: number;
  private maxKeys: number;

  constructor(windowMs: number, max: number, maxKeys = 5_000) {
    this.windowMs = windowMs;
    this.max = max;
    this.maxKeys = maxKeys;
  }

  /** Counts one request; true while the key is within its allowance. */
  hit(key: string, now: number = Date.now()): boolean {
    const cur = this.seen.get(key);
    if (!cur || now - cur.start >= this.windowMs) {
      this.seen.set(key, { start: now, hits: 1 });
      this.sweep(now);
      return true;
    }
    cur.hits += 1;
    return cur.hits <= this.max;
  }

  /** Drops expired windows once the map is big; if it is still big, the oldest half. */
  private sweep(now: number): void {
    if (this.seen.size <= this.maxKeys) return;
    for (const [k, v] of this.seen) if (now - v.start >= this.windowMs) this.seen.delete(k);
    if (this.seen.size <= this.maxKeys) return;
    const oldest = [...this.seen.entries()].sort((a, b) => a[1].start - b[1].start).slice(0, Math.ceil(this.seen.size / 2));
    for (const [k] of oldest) this.seen.delete(k);
  }
}
