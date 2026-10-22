import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { docxBuffer } from "./docx-export.ts";

const meta = { title: "Transformation Concept", projectName: "Tourenplanung", agentName: "Maya", createdAt: "2026-10-22T10:00:00Z", version: 2 };

const DOC = `# Transformation Concept

## Management Summary

\`\`\`agxp-summary
Was | Die Planung wird zusammengeführt.
Warum | Heute dauert sie zwölf Minuten.
Mehrwert | Unter drei Minuten.
Risiko | Disponenten blockieren.
Potenzial | Zweite Region.
\`\`\`

## Maßnahmen

- Erstens **wichtig**
- Zweitens

| Tool | Aufwand |
|---|---|
| A | gering |
`;

async function xmlOf(markdown: string): Promise<string> {
  const buf = await docxBuffer(meta, markdown);
  const zip = await JSZip.loadAsync(buf);
  return zip.file("word/document.xml")!.async("string");
}

test("the file is a real .docx: a zip with the main document inside", async () => {
  const buf = await docxBuffer(meta, DOC);
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  const zip = await JSZip.loadAsync(buf);
  assert.ok(zip.file("word/document.xml"));
  assert.ok(zip.file("word/styles.xml"));
});

test("the words of the document, its tables and its byline are in the file", async () => {
  const xml = await xmlOf(DOC);
  for (const s of ["Transformation Concept", "Management Summary", "Größtes Risiko", "Disponenten blockieren.", "Erstens", "wichtig", "gering", "Tourenplanung", "Maya", "Version 2"]) {
    assert.ok(xml.includes(s), `missing: ${s}`);
  }
  assert.ok(xml.includes("<w:tbl>"), "no table");
});

test("the document's own first heading is the title, not repeated", async () => {
  const xml = await xmlOf(DOC);
  const count = xml.split("Transformation Concept").length - 1;
  assert.equal(count, 1);
});

test("a document with no heading gets its title from the metadata", async () => {
  const xml = await xmlOf("Nur ein Absatz.");
  assert.ok(xml.includes("Transformation Concept"));
  assert.ok(xml.includes("Nur ein Absatz."));
});

test("an empty document still produces a valid file", async () => {
  const buf = await docxBuffer(meta, "");
  assert.equal(buf.subarray(0, 2).toString(), "PK");
});
