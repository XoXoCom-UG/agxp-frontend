import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { clientIp, ipKey, WindowCounter } from "@/lib/client-ip";
import { takeIpSlot } from "@/lib/entitlement-server";

/**
 * ip-gate.ts — a limit per network, ahead of everything that costs something.
 *
 * The per-account limits already stop one signed-in user. They do not stop what
 * happens before there is a user: a flood of requests with no token, each of
 * which makes the route ask Supabase who is calling; or one person opening a
 * hundred accounts to get a hundred allowances; or guessing invitation keys
 * from many accounts at once. An address limit answers all three, and it runs
 * BEFORE the session is looked up, so a refused request costs nothing.
 *
 * Two counts, like the account limit: one in this instance's memory (free, and
 * it stops a flood from reaching the database at all) and one every instance
 * shares (take_ip_slot, migration 0023).
 *
 * The numbers are per network, and a network can be a whole office or a mobile
 * carrier, so they are well above what one person does. The account limits are
 * the tight ones.
 */

const SCOPES = {
  /** A conversation turn. The account itself has no per-minute limit any more. */
  chat:    { max: 60, windowSeconds: 60 },
  /** Naming a project: the account allows 10 a minute. */
  title:   { max: 40, windowSeconds: 60 },
  /** Guessing an invitation key: the account allows 10 in ten minutes. */
  redeem:  { max: 25, windowSeconds: 600 },
  /** Deleting an account: the account allows 5 in ten minutes. */
  account: { max: 10, windowSeconds: 600 },
  /** The email for a serious problem: the account allows 10 in ten minutes. */
  feedback: { max: 30, windowSeconds: 600 },
} as const;

export type IpScope = keyof typeof SCOPES;

const counters = Object.fromEntries(
  (Object.keys(SCOPES) as IpScope[]).map(k => [k, new WindowCounter(SCOPES[k].windowSeconds * 1000, SCOPES[k].max)]),
) as Record<IpScope, WindowCounter>;

/**
 * Only a keyed hash of the network is ever stored or logged. An address is
 * personal data, and the whole IPv4 space is small enough to hash by brute
 * force — so the hash is keyed. IP_HASH_SALT if it is set, otherwise the
 * service role key, which this server already has and the browser never does.
 */
function hashed(network: string): string {
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "agxp-dev";
  return createHmac("sha256", salt).update(network).digest("hex").slice(0, 32);
}

/**
 * Null when the request may go on, otherwise the 429 to send back.
 * A request with no usable address is let through: there is nothing to count,
 * and grouping every such request together would let one of them lock out the rest.
 */
export async function ipGate(req: Request, scope: IpScope): Promise<NextResponse | null> {
  const ip = clientIp(req.headers);
  if (!ip) return null;

  const { max, windowSeconds } = SCOPES[scope];
  const key = hashed(ipKey(ip));

  if (!counters[scope].hit(key) || !(await takeIpSlot(key, scope, max, windowSeconds))) {
    return NextResponse.json(
      { error: "Too many requests from this network. Wait a few minutes, then try again.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.min(windowSeconds, 300)) } },
    );
  }
  return null;
}
