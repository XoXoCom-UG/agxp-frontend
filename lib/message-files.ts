import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { parseMarkers, type FileRef } from "@/lib/message-markers";

/**
 * message-files.ts — turns [[FILE:]] markers back into something Claude reads.
 *
 * The browser uploads a file and writes a marker into the message; it never
 * sends the bytes to this API. On every turn the server resolves the markers
 * again from storage. That costs a download per turn, and buys three things:
 * the client never holds megabytes of base64, a conversation reopened next
 * week still has its attachments, and nothing about an attachment can be
 * forged by the client — the path is read back under the caller's own token.
 *
 * That last point is the reason this uses the ANON key with the user's bearer
 * token rather than the service role. A marker is just text in a message, and
 * a message is something the client sends. With the service role, a crafted
 * "[[FILE: <someone else's uuid>/…]]" would read another customer's document.
 * Under the caller's token, row level security answers that with nothing.
 */

/**
 * Total attachment bytes a single conversation may carry into one request.
 *
 * The whole history is resent every turn, so without a ceiling a project that
 * accumulates ten PDFs pays for all ten on every message. Prompt caching
 * makes the repeat a tenth of the price, not free.
 */
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/** Text files are inlined; this is how much of one is read. */
const MAX_TEXT_CHARS = 120_000;

type Block = Anthropic.ContentBlockParam;

function clientFor(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const isImage = (mime: string) =>
  mime === "image/png" || mime === "image/jpeg" || mime === "image/gif" || mime === "image/webp";

/**
 * Rebuilds the message list with attachments resolved into content blocks.
 *
 * A file that cannot be read is not an error: the conversation continues with
 * a line saying so, because failing the whole turn over one unreadable upload
 * would lose the user's message too.
 */
export async function withAttachments(
  messages: { role: "user" | "assistant"; content: string }[],
  token: string,
): Promise<Anthropic.MessageParam[]> {
  const anyFiles = messages.some(m => m.role === "user" && m.content.includes("[[FILE:"));
  if (!anyFiles) return messages.map(m => ({ role: m.role, content: m.content }));

  const supabase = clientFor(token);
  if (!supabase) return messages.map(m => ({ role: m.role, content: m.content }));

  let budget = MAX_TOTAL_BYTES;
  const out: Anthropic.MessageParam[] = [];

  for (const m of messages) {
    if (m.role !== "user") {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    const parsed = parseMarkers(m.content);
    if (!parsed.files.length) {
      out.push({ role: "user", content: m.content });
      continue;
    }

    const blocks: Block[] = [];
    for (const ref of parsed.files) {
      const block = await resolve(supabase, ref, budget);
      budget -= block.bytes;
      blocks.push(block.block);
    }
    // The text goes last so the file is context for the question, not an
    // afterthought appended to it.
    if (parsed.text) blocks.push({ type: "text", text: parsed.text });
    out.push({ role: "user", content: blocks.length ? blocks : m.content });
  }

  return out;
}

async function resolve(
  supabase: SupabaseClient,
  ref: FileRef,
  budget: number,
): Promise<{ block: Block; bytes: number }> {
  const note = (text: string): { block: Block; bytes: number } =>
    ({ block: { type: "text", text }, bytes: 0 });

  if (budget <= 0) {
    return note(`[Anhang "${ref.name}" ausgelassen — zu viele Dateien in diesem Gespräch.]`);
  }

  const { data, error } = await supabase.storage.from("project-files").download(ref.path);
  if (error || !data) {
    return note(`[Anhang "${ref.name}" konnte nicht gelesen werden.]`);
  }
  if (data.size > budget) {
    return note(`[Anhang "${ref.name}" ausgelassen — zu viele Dateien in diesem Gespräch.]`);
  }

  if (ref.mime.startsWith("text/")) {
    const text = (await data.text()).slice(0, MAX_TEXT_CHARS);
    return {
      block: { type: "text", text: `Datei "${ref.name}":\n\n${text}` },
      bytes: data.size,
    };
  }

  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");

  if (ref.mime === "application/pdf") {
    return {
      block: {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
        title: ref.name,
      },
      bytes: data.size,
    };
  }

  if (isImage(ref.mime)) {
    return {
      block: {
        type: "image",
        source: {
          type: "base64",
          media_type: ref.mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: base64,
        },
      },
      bytes: data.size,
    };
  }

  // The bucket's allowed_mime_types should have stopped this already.
  return note(`[Anhang "${ref.name}" hat ein Format, das nicht gelesen werden kann.]`);
}
