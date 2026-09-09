"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AgentType } from "@/lib/agents";
import { md } from "@/lib/markdown";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconX, IconCopy, IconCheck, IconDownload, IconPrint } from "@/components/layout/agxp-icons";

export interface DeliverableDoc {
  /** "Transformation Concept" | "Change Plan" — whatever the agent titled it. */
  title: string;
  role: AgentType;
  agentName: string;
  projectName: string;
  /** Markdown, markers already stripped. */
  content: string;
  createdAt: string;
}

interface Heading {
  level: number;
  text: string;
  /** Position among ALL headings md() renders, used to find the DOM node. */
  domIndex: number;
}

/** Table of contents, in document order. Fenced code is skipped — `#` in a
 *  code block is not a heading, and md() doesn't render it as one either. */
function outline(markdown: string): Heading[] {
  const out: Heading[] = [];
  let domIndex = 0;
  let inFence = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^(#{1,4})\s+(.+)/);
    if (!m) continue;
    if (m[1].length <= 2) {
      out.push({ level: m[1].length, text: m[2].replace(/[*`]/g, "").trim(), domIndex });
    }
    domIndex++;
  }
  return out;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
}

/**
 * The deliverable, read as a document instead of as a chat message: a paper
 * sheet with its own table of contents, copy/download/print, and Esc to close.
 * Portaled to <body> so it escapes the panel's overflow + stacking context.
 */
export function DeliverableView({ doc, onClose }: { doc: DeliverableDoc; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState(0);
  const paperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toc = useMemo(() => outline(doc.content), [doc.content]);
  const html = useMemo(() => md(doc.content), [doc.content]);
  const words = useMemo(() => doc.content.split(/\s+/).filter(Boolean).length, [doc.content]);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // Esc closes; the page behind must not scroll while the document is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function headingNodes(): HTMLElement[] {
    if (!bodyRef.current) return [];
    return Array.from(bodyRef.current.querySelectorAll<HTMLElement>("h1,h2,h3,h4"));
  }

  function jumpTo(h: Heading) {
    const node = headingNodes()[h.domIndex];
    const scroller = paperRef.current;
    if (!node || !scroller) return;
    scroller.scrollTo({ top: node.offsetTop - 24, behavior: "smooth" });
  }

  // Scroll spy: the last heading that has passed the top of the sheet wins.
  function onScroll() {
    const scroller = paperRef.current;
    if (!scroller) return;
    const nodes = headingNodes();
    let idx = 0;
    toc.forEach((h, i) => {
      const node = nodes[h.domIndex];
      if (node && node.offsetTop - 60 <= scroller.scrollTop) idx = i;
    });
    setActive(idx);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc.content);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the download button still works */ }
  }

  function download() {
    const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(doc.projectName)}-${slug(doc.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const date = new Date(doc.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  if (!mounted) return null;

  return createPortal(
    <div className="doc-portal">
      <div className="doc-overlay" onClick={onClose} />
      <div className="doc-modal" role="dialog" aria-modal="true" aria-label={doc.title}>
        <header className="doc-head">
          <AgentMascot role={doc.role} state="idle" size={40} />
          <div className="doc-id">
            <span className="kind">{doc.role === "coach" ? "Coach deliverable" : "Consultant deliverable"}</span>
            <h2>{doc.title}</h2>
            <span className="meta">{doc.projectName} · {doc.agentName} · {date}</span>
          </div>
          <div className="doc-actions">
            <button className="doc-btn" onClick={copy}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied ? "Copied" : "Copy"}
            </button>
            <button className="doc-btn" onClick={download}><IconDownload size={13} />.md</button>
            <button className="doc-btn" onClick={() => window.print()}><IconPrint size={13} />Print / PDF</button>
            <button className="doc-btn icon" onClick={onClose} data-tooltip="Close (Esc)" aria-label="Close"><IconX size={14} /></button>
          </div>
        </header>

        <div className="doc-main">
          <aside className="doc-toc">
            <span className="lbl">Contents</span>
            <nav>
              {toc.map((h, i) => (
                <button key={`${h.domIndex}-${h.text}`} className={`toc-item lvl${h.level} ${i === active ? "on" : ""}`}
                  onClick={() => jumpTo(h)}>
                  <span className="tick" />{h.text}
                </button>
              ))}
              {toc.length === 0 && <span className="toc-empty">No sections</span>}
            </nav>
            <div className="doc-stats">
              <div><b>{toc.length}</b><span>sections</span></div>
              <div><b>{words.toLocaleString()}</b><span>words</span></div>
              <div><b>{Math.max(1, Math.round(words / 200))}</b><span>min read</span></div>
            </div>
          </aside>

          <div className="doc-paper" ref={paperRef} onScroll={onScroll}>
            <div className="doc-sheet">
              <div className="doc-body" ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
              <div className="doc-foot">
                <span>{doc.title} · {doc.projectName}</span>
                <span>Generated with AgXP · {doc.agentName} · {date}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
