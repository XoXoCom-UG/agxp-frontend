"use client";

import { useEffect, useState } from "react";

const WORD_MS = 55;

/**
 * Visual-only word-by-word reveal of a reply that has *already fully
 * arrived* — no real network streaming (the API makes one blocking call).
 * Reveals the plain text with a blinking-cursor tail; the caller swaps to
 * the real markdown-rendered HTML via onDone, since revealing raw markdown
 * source word-by-word would flash literal `**`/`#` characters mid-animation.
 */
export function StreamingText({ text, onDone }: { text: string; onDone?: () => void }) {
  const words = text.split(" ");
  const [count, setCount] = useState(0);
  const done = count >= words.length;

  useEffect(() => {
    if (done) { onDone?.(); return; }
    const t = setTimeout(() => setCount(c => c + 1), WORD_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done]);

  return (
    <span className="streaming-text">
      {words.slice(0, count).join(" ")}
      {!done && <span className="streaming-cursor" />}
    </span>
  );
}
