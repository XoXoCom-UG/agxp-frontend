import { COMPANY } from "@/lib/company";

/**
 * /.well-known/security.txt (RFC 9116): where someone who finds a security
 * hole should write. Without it, a well-meaning researcher has no address
 * and the report goes nowhere — or somewhere public.
 *
 * Read from lib/company.ts like the legal pages. Until an address is filled
 * in there is nothing true to publish, so it answers 404 rather than a file
 * pointing at nobody.
 */
export function GET() {
  const contact = (COMPANY.privacyEmail || COMPANY.email).trim();
  if (!contact) return new Response("Not found", { status: 404 });

  // RFC 9116 requires an expiry; a year ahead, renewed by every deploy.
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: de, en",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
