"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/layout/agxp-icons";

/**
 * Expandable "reasoning" trace for the model's real extended-thinking text
 * (High effort only — see app/api/agent/chat/route.ts). Ported from a
 * reference design that staged a fake multi-second reveal while the model
 * was "still thinking"; trimmed to just that case since here the full text
 * is already known by the time this renders (the wait itself uses
 * LoadingState) — so it always starts collapsed, settled, and only
 * expands/collapses on a real click.
 */
export function ThinkingState({ paragraphs }: { paragraphs: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (paragraphs.length === 0) return null;
  return (
    <div className="thinking-state">
      <button type="button" className="thinking-header" aria-expanded={expanded} onClick={() => setExpanded(e => !e)}>
        <span className="thinking-header-label">Show reasoning</span>
        <IconChevronDown size={12} className={`thinking-chevron${expanded ? " open" : ""}`} />
      </button>
      {expanded && (
        <div className="thinking-trace">
          {paragraphs.map((p, i) => (
            <p key={i} className="thinking-row" style={{ animationDelay: `${i * 80}ms` }}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}
