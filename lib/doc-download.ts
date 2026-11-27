/**
 * Saving a finished document as a file, in the browser — nothing is uploaded.
 * Shared by the full reading view and the Cockpit (2026-11-27), so the Word
 * file is the same wherever it is asked for. The Word library is loaded by the
 * click, not before, so it is not part of anyone's first page.
 */
export interface DownloadableDoc {
  title: string;
  projectName: string;
  agentName: string;
  createdAt: string;
  version?: number;
  content: string;
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadWord(doc: DownloadableDoc): Promise<void> {
  const { docxBlob } = await import("@/lib/docx-export");
  const blob = await docxBlob({
    title: doc.title, projectName: doc.projectName, agentName: doc.agentName,
    createdAt: doc.createdAt, version: doc.version,
  }, doc.content);
  save(blob, `${slug(doc.projectName)}-${slug(doc.title)}.docx`);
}

export function downloadMarkdown(doc: DownloadableDoc): void {
  save(new Blob([doc.content], { type: "text/markdown;charset=utf-8" }), `${slug(doc.projectName)}-${slug(doc.title)}.md`);
}
