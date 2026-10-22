/**
 * docx-export.ts — the finished document as a Word file.
 *
 * The page the user reads is markdown plus CSS-drawn graphics; neither survives
 * a trip into Word. So this takes the structure (lib/doc-blocks.ts: headings,
 * bullets, and a table for every graphic) and writes it with the `docx`
 * library, in the document's own accent colour. It runs in the browser, on the
 * markdown the user already has open: nothing is sent anywhere, and nothing is
 * stored — the file is made when the button is pressed.
 *
 * Loaded on demand (`await import(...)` in the document view), so the library
 * is not part of anyone's first page load.
 *
 * Relative imports only: the test runner does not know the "@/" alias.
 */

import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { parseDoc, runs, type Block } from "./doc-blocks.ts";

export interface ExportMeta {
  /** "Transformation Concept" | "Change Plan" — whatever the agent titled it. */
  title: string;
  projectName: string;
  agentName: string;
  createdAt: string;
  version?: number;
}

/** The accent (--primary), and the quiet tones around it. */
const ACCENT = "154E80";
const INK = "1A1D23";
const MUTED = "5B6472";
const LINE = "D0D5DD";
const HEAD_FILL = "E8EEF6";
const CODE_FILL = "F3F4F6";

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

const textRuns = (text: string, base: { bold?: boolean; color?: string; size?: number } = {}) =>
  runs(text).map(r => new TextRun({
    text: r.text,
    bold: base.bold || r.bold,
    italics: r.italics,
    font: r.code ? "Consolas" : undefined,
    color: base.color,
    size: base.size,
  }));

/** A cell's text, one paragraph per line (the agxp blocks use "\n" inside a cell). */
function cellParagraphs(text: string, opts: { bold?: boolean; color?: string } = {}): Paragraph[] {
  const lines = text.split("\n");
  return lines.map(l => new Paragraph({
    spacing: { after: lines.length > 1 ? 40 : 0 },
    children: textRuns(l, opts),
  }));
}

function table(b: Extract<Block, { kind: "table" }>): Table {
  const cols = Math.max(b.header?.length ?? 0, ...b.rows.map(r => r.length), 1);
  const even = Math.floor(100 / cols);
  const widths = b.widths && b.widths.length === cols ? b.widths : Array.from({ length: cols }, () => even);
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };

  const cell = (text: string, col: number, o: { head?: boolean; label?: boolean } = {}) => new TableCell({
    width: { size: widths[col], type: WidthType.PERCENTAGE },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: o.head || o.label ? { type: ShadingType.CLEAR, fill: HEAD_FILL, color: "auto" } : undefined,
    children: cellParagraphs(text, { bold: o.head || o.label, color: o.head ? ACCENT : undefined }),
  });

  const head = b.header
    ? [new TableRow({ tableHeader: true, cantSplit: true, children: b.header.map((h, c) => cell(h, c, { head: true })) })]
    : [];
  const body = b.rows.map(r => new TableRow({
    cantSplit: true,
    children: Array.from({ length: cols }, (_, c) => cell(r[c] ?? "", c, { label: !b.header && c === 0 })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [...head, ...body],
  });
}

/** Blocks → Word's building blocks. A table is followed by a gap, as Word runs them together. */
function render(blocks: Block[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let first = true;
  for (const b of blocks) {
    switch (b.kind) {
      case "heading": {
        // The document's own first line is its title; a second one would repeat it.
        if (first && b.level === 1) {
          out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: textRuns(b.text) }));
        } else {
          out.push(new Paragraph({ heading: HEADINGS[Math.min(b.level, 4) - 1], children: textRuns(b.text) }));
        }
        break;
      }
      case "para":
        out.push(new Paragraph({ spacing: { after: 120, line: 300 }, children: textRuns(b.text) }));
        break;
      case "label":
        out.push(new Paragraph({
          spacing: { before: 200, after: 80 }, keepNext: true,
          children: [new TextRun({ text: b.text.toUpperCase(), bold: true, color: ACCENT, size: 18, characterSpacing: 40 })],
        }));
        break;
      case "bullet":
        out.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60, line: 288 }, children: textRuns(b.text) }));
        break;
      case "number":
        out.push(new Paragraph({
          indent: { left: 540, hanging: 300 }, spacing: { after: 60, line: 288 },
          children: [new TextRun({ text: `${b.n}.\t` }), ...textRuns(b.text)],
          tabStops: [{ type: "left", position: 540 }],
        }));
        break;
      case "code":
        out.push(...b.text.split("\n").map(l => new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: CODE_FILL, color: "auto" },
          spacing: { after: 0 },
          children: [new TextRun({ text: l || " ", font: "Consolas", size: 19 })],
        })), new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case "table":
        out.push(table(b), new Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
    }
    first = false;
  }
  return out;
}

const dateOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
};

/** The Word document for one finished deliverable. */
export function buildDocument(meta: ExportMeta, markdown: string): Document {
  const blocks = parseDoc(markdown);
  const titled = blocks[0]?.kind === "heading" && blocks[0].level === 1;
  const date = dateOf(meta.createdAt);
  const line = [meta.projectName, meta.agentName, date, meta.version ? `Version ${meta.version}` : ""].filter(Boolean).join("  ·  ");

  const children: (Paragraph | Table)[] = [
    ...(titled ? [] : [new Paragraph({ heading: HeadingLevel.TITLE, children: textRuns(meta.title) })]),
    ...render(blocks),
  ];
  // The byline goes right under the title, wherever the title came from.
  children.splice(1, 0, new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: line, color: MUTED, size: 20 })],
  }));

  return new Document({
    creator: "AgentiX Projects",
    title: `${meta.title} · ${meta.projectName}`,
    description: `Generated with AgentiX by ${meta.agentName}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: INK }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 52, bold: true, color: ACCENT }, paragraph: { spacing: { before: 0, after: 80 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 34, bold: true, color: ACCENT }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, color: ACCENT }, paragraph: { spacing: { before: 320, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 80 }, keepNext: true } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 22, bold: true, color: MUTED }, paragraph: { spacing: { before: 200, after: 60 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 270 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 1247, bottom: 1247, left: 1247, right: 1247 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `${meta.title} · ${meta.projectName}   |   Generated with AgentiX   |   Seite `, color: MUTED, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

/** The .docx as a Blob, for a download in the browser. */
export function docxBlob(meta: ExportMeta, markdown: string): Promise<Blob> {
  return Packer.toBlob(buildDocument(meta, markdown));
}

/** The .docx as bytes, for tests and anything outside a browser. */
export function docxBuffer(meta: ExportMeta, markdown: string): Promise<Buffer> {
  return Packer.toBuffer(buildDocument(meta, markdown));
}
