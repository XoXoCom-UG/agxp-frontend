"use client";

import { useEffect, useRef, useState } from "react";
import { Highlight, type PrismTheme } from "prism-react-renderer";
import { IconCheck, IconCopy } from "@/components/layout/agxp-icons";

const COPY_RESET_MS = 1800;

// Built from the app's own tokens (agxp-design.css / globals.css) instead of
// a one-off accent color, so a code block matches the surrounding chat
// theme (and its light/dark swap) instead of looking like a pasted-in
// component with its own palette.
const THEME: PrismTheme = {
  plain: { color: "var(--text-primary)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--text-muted)", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "var(--text-secondary)" } },
    { types: ["keyword", "selector", "atrule", "important", "tag"], style: { color: "var(--cat-business)" } },
    { types: ["string", "char", "inserted", "url"], style: { color: "var(--cat-tooling)" } },
    { types: ["function"], style: { color: "var(--cat-agile)" } },
    { types: ["attr-name"], style: { color: "var(--cat-agile)", fontStyle: "italic" } },
    { types: ["number", "boolean", "constant", "symbol", "deleted"], style: { color: "var(--cat-security)" } },
    { types: ["class-name", "maybe-class-name", "builtin"], style: { color: "var(--text-primary)", fontWeight: "600" } },
    { types: ["property", "variable", "parameter"], style: { color: "var(--text-primary)" } },
    { types: ["regex"], style: { color: "var(--cat-security)" } },
  ],
};

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-secure contexts where the Clipboard API is unavailable.
        const area = document.createElement("textarea");
        area.value = code;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
  }

  return (
    <button type="button" className="code-block-copy" data-tooltip={copied ? "Copied" : "Copy code"} onClick={copy}>
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
    </button>
  );
}

/** A fenced code block from an agent message — real per-token syntax
 * highlighting (prism-react-renderer) themed from this app's own CSS
 * variables, a header with the language + a copy button, and line numbers.
 * Only rendered once a message is done streaming (see project-chat-panel's
 * `mdBlocks` usage) — mid-stream, a fence still shows as plain text. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lang = language || "text";
  return (
    <div className="code-block">
      <div className="code-block-head">
        <span className="code-block-lang">{lang}</span>
        <CopyButton code={code} />
      </div>
      <div className="code-block-body">
        <Highlight code={code} language={lang} theme={THEME}>
          {({ tokens, getLineProps, getTokenProps }) => {
            const gutterWidth = `${String(tokens.length).length + 1}ch`;
            return (
              <pre className="code-block-pre">
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line })} className="code-block-line">
                    <span className="code-block-gutter" style={{ width: gutterWidth }}>{i + 1}</span>
                    <span className="code-block-code">
                      {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                    </span>
                  </div>
                ))}
              </pre>
            );
          }}
        </Highlight>
      </div>
    </div>
  );
}
