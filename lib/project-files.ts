import { createClient } from "@/lib/supabase";
import type { FileRef } from "@/lib/message-markers";

/**
 * project-files.ts — attachments, from the browser's side.
 *
 * There is no table. A file lives in the private `project-files` bucket under
 * "<user id>/<project id>/<uuid>.<ext>", and the only record that it belongs
 * to a message is the [[FILE:]] marker inside that message. Migration 0011
 * explains why; the short version is that the message row then stays the
 * whole record, and the owner check is a single rule on the path.
 *
 * Nothing here reads file bytes back. The browser uploads and forgets; the
 * server resolves the path again on every turn (lib/message-files.ts), so a
 * conversation reloaded tomorrow still has its attachments without the client
 * holding megabytes of base64 in memory.
 */

export const BUCKET = "project-files";

/**
 * What Claude can actually read. PDFs and images go to the model as they are;
 * text files are inlined. Anything else would arrive as bytes it cannot use,
 * so it is refused here rather than uploaded and silently ignored.
 */
export const ACCEPTED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
};

/** For the file picker, so the OS dialog filters before the user chooses. */
export const ACCEPT_ATTR = Object.keys(ACCEPTED).join(",") + ",.md,.csv,.txt";

/**
 * 10 MB, matching the bucket's own limit in migration 0011.
 *
 * The real cost is not the upload. Every turn resends the whole conversation,
 * so an attached file is paid for again on each one — prompt caching makes
 * that a tenth of the price, not nothing. A 30 MB scan would quietly become
 * the most expensive thing in the project.
 */
export const MAX_BYTES = 10 * 1024 * 1024;

/** Human reason the file was refused, or null when it is fine. */
export function rejectReason(file: File): string | null {
  const mime = normaliseMime(file);
  if (!ACCEPTED[mime]) {
    return "Only PDFs, images, and text files (txt, csv, md) can be read.";
  }
  if (file.size > MAX_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

/**
 * Browsers disagree about Markdown and CSV: Chrome often reports "" or
 * "application/octet-stream" for a .md file. Falling back to the extension
 * keeps a legitimate file from being refused for a reason the user cannot see.
 */
function normaliseMime(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (ACCEPTED[type]) return type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "md") return "text/markdown";
  if (ext === "csv") return "text/csv";
  if (ext === "txt") return "text/plain";
  return type;
}

/** Uploads one file and returns the reference to put in the message. */
export async function uploadProjectFile(projectId: string, file: File): Promise<FileRef> {
  const reason = rejectReason(file);
  if (reason) throw new Error(reason);

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Your session has expired. Sign in again.");

  const mime = normaliseMime(file);
  const ext = ACCEPTED[mime];
  const path = `${userId}/${projectId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    // Never overwrite: the path carries a fresh uuid, so a collision would
    // mean something is wrong rather than something to resolve.
    upsert: false,
  });
  if (error) throw new Error(uploadMessage(error.message));

  return { path, name: file.name, mime };
}

/** Removes a file the user attached and then changed their mind about. */
export async function removeProjectFile(path: string): Promise<void> {
  await createClient().storage.from(BUCKET).remove([path]);
}

/** The marker the composer appends to the message text. */
export function fileMarker(ref: FileRef): string {
  // Pipes would break the three-field split, and a file name is the one part
  // a user controls. Spaces around the separators match the other markers.
  const clean = (s: string) => s.replace(/[|\]\[\n\r]/g, " ").trim();
  return `[[FILE: ${clean(ref.path)} | ${clean(ref.name)} | ${clean(ref.mime)}]]`;
}

/** Storage errors are written for developers; these are the ones users hit. */
function uploadMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("exceeded the maximum allowed size")) {
    return `That file is too large. The limit is ${MAX_BYTES / 1024 / 1024} MB.`;
  }
  if (m.includes("mime type") || m.includes("not allowed")) {
    return "That kind of file can't be read.";
  }
  if (m.includes("bucket not found")) {
    // The one failure that is ours, not theirs — say which script fixes it,
    // the way lib/db-error.ts does for RLS.
    return "File uploads aren't set up on the server yet (migration 0011).";
  }
  if (m.includes("row-level security") || m.includes("unauthorized")) {
    return "You're not allowed to upload here. Sign in again, then retry.";
  }
  return "The upload didn't go through. Try again.";
}
