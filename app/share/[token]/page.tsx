import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { serviceClient } from "@/lib/server-db";
import { parseMarkers } from "@/lib/message-markers";
import { md } from "@/lib/markdown";
import { BrandLogo } from "@/components/layout/brand-logo";

/**
 * A shared document, read-only (0036_doc_shares.sql, 2026-11-27).
 *
 * Read on the server with the service role, by token, and only while the share
 * is not revoked: the token is the whole permission, so nobody needs an
 * account to open it, and nothing else of the project is ever read. The page
 * shows the stored agent message exactly as written — never text of its own —
 * through the same escaping renderer as the app (md()), so a link on our domain
 * can only show what an agent wrote.
 *
 * Not indexed, no referrer, rendered fresh: a revoked link stops working at once.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared document",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const TOKEN = /^[0-9a-f]{64}$/;

async function readShare(token: string) {
  if (!TOKEN.test(token)) return null;
  const db = serviceClient();
  if (!db) return null;
  const { data: share } = await db.from("agxp_doc_shares")
    .select("message_id, project_id, created_at")
    .eq("token", token).is("revoked_at", null).maybeSingle();
  if (!share) return null;
  const { data: msg } = await db.from("agxp_project_messages")
    .select("content, created_at, role, project_id")
    .eq("id", share.message_id).maybeSingle();
  // Only an agent's reply in the project the share names.
  if (!msg || msg.role !== "assistant" || msg.project_id !== share.project_id) return null;
  return { content: msg.content as string, createdAt: msg.created_at as string };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await readShare(token);
  if (!shared) notFound();

  const parsed = parseMarkers(shared.content);
  const title = parsed.doc || "Document";
  const date = new Date(shared.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="share-page">
      <header className="share-head">
        <Link href="/" aria-label="AgentiX Projects"><BrandLogo size={26} /></Link>
        <span className="share-note">Read-only · shared {date}</span>
      </header>
      <main className="share-main">
        <article className="doc-sheet share-sheet">
          <h1 className="share-title">{title}</h1>
          <div className="doc-body" dangerouslySetInnerHTML={{ __html: md(parsed.text) }} />
        </article>
        <p className="share-foot">
          Written with an AI consultant on AgentiX Projects. AI can get things wrong — check anything you rely on.
        </p>
      </main>
    </div>
  );
}
