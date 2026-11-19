/**
 * cache-layout.ts — where the cache breakpoint goes, and what follows it.
 *
 * Prompt caching is a prefix match: tools, then system, then messages, up to
 * the last block marked cache_control. Anything that changes from one turn to
 * the next has to come AFTER that mark, or everything behind it misses.
 *
 * What changes per turn, and so travels after the mark: the other agent's
 * transcript (lib/agent-prompt.ts peerPrompt) and the language note
 * (lib/reply-language.ts languageNote). Both are for the model only and are
 * never stored, so next turn the history is rebuilt without them and still
 * matches what was cached up to the person's own words.
 *
 * Before 2026-11-20 the breakpoint was set only when there was no peer block,
 * which meant that in a project with both agents the history was billed at
 * full price on every message.
 */
import type Anthropic from "@anthropic-ai/sdk";

export function layoutMessages(msgs: Anthropic.MessageParam[], tail: string[]): Anthropic.MessageParam[] {
  const last = msgs.length - 1;
  if (last < 0) return msgs;
  const out = [...msgs];
  const m = out[last];
  const blocks: Anthropic.ContentBlockParam[] = typeof m.content === "string"
    ? [{ type: "text", text: m.content }]
    : [...m.content];

  // On the LAST block of the last message, whatever shape it has: an attachment
  // turns the content into an array, and a cache_control on the wrong block
  // silently stops the prefix from being reused.
  const tailBlock = blocks[blocks.length - 1];
  if (tailBlock) {
    blocks[blocks.length - 1] = { ...tailBlock, cache_control: { type: "ephemeral" } } as Anthropic.ContentBlockParam;
  }
  for (const text of tail) {
    if (text) blocks.push({ type: "text", text });
  }
  out[last] = { role: m.role, content: blocks };
  return out;
}
