import { deliverableFor, isDiscussCommand, isOptimizeCommand, isSkipCommand, isDeliverableCommand, type Deliverable } from "./deliverables.ts";
import { parseStartReply, type StartPlan } from "./start-plan.ts";
import type { TypeTemplate } from "./agent-types.ts";

/**
 * A pretend assistant for the developer's own machine (Ana, 2026-11-26): to see
 * the Cockpit, the chat and the document without a model key or a database
 * service key. The routes answer with these canned texts INSTEAD of calling
 * the model — no lease, no spend, nothing stored.
 *
 * It is on only in `next dev` (NODE_ENV === "development"), and then when
 * ANTHROPIC_API_KEY is missing or AGXP_FAKE_AI=1 is set. A production build
 * can never take this path, whatever the environment says.
 */
export function fakeAiOn(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "development") return false;
  return env.AGXP_FAKE_AI === "1" || !env.ANTHROPIC_API_KEY;
}

/** What the Prompt Pad's start call answers: the General Consultant with its first methods. */
export function fakeStartPlan(types: TypeTemplate[]): StartPlan | null {
  const general = types.find(t => t.id === "general") ?? types[0];
  if (!general) return null;
  return parseStartReply(JSON.stringify({
    kind: general.id,
    reason: "Demo mode: this is a pretend recommendation, no model was asked.",
    methods: [...general.primary, ...general.secondary].slice(0, 6),
  }), types);
}

type Turn = "first" | "optimize" | "skip" | "discuss" | "generate" | "answer";

const OPTIMIZE_CHOICE = /optimi[sz]e all|alle methoden optimieren|optimizeaz/i;

/** What each user message was, from the stored history. */
function classify(turns: string[], d: Deliverable): Turn[] {
  const generate = (t: string) => t.trim() === d.generatePrompt.trim() || t.trim() === d.regeneratePrompt.trim();
  let seenFirst = false;
  return turns.map(t => {
    if (isOptimizeCommand(t) || OPTIMIZE_CHOICE.test(t)) return "optimize";
    if (isSkipCommand(t)) return "skip";
    if (isDiscussCommand(t)) return "discuss";
    if (generate(t) || isDeliverableCommand(t)) return "generate";
    if (!seenFirst) { seenFirst = true; return "first"; }
    return "answer";
  });
}

const gist = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 90);

function marks(d: Deliverable, station: number): string {
  const total = d.stations.length;
  const label = d.stations[Math.min(station, total - 1)].label;
  const pct = Math.min(100, Math.round((station / total) * 20) * 5);
  return `\n[[TOPIC: ${Math.min(station + 1, total)}/${total} ${label}]]\n[[PROGRESS: ${pct}]]`;
}

/**
 * The pretend consultant's reply to the conversation so far.
 * `turns` are the user's stored messages, oldest first.
 */
export function fakeConsultantReply(turns: string[], d: Deliverable): string {
  const kinds = classify(turns, d);
  const last = kinds[kinds.length - 1];
  const first = turns[kinds.indexOf("first")] ?? turns[0] ?? "";
  const total = d.stations.length;
  const demo = "(Demo mode: a pretend answer, no model was asked.)";

  if (last === "generate") {
    const sections = d.stations.slice(0, Math.min(total, 6))
      .map(s => `## ${s.label}\n- ${s.goal}\n- Pretend content for the demo, based on: “${gist(first)}”.`)
      .join("\n\n");
    return `[[DOC: ${d.title}]]\n# ${d.title}\n\n_${demo}_\n\n${sections}\n`;
  }
  if (last === "discuss") {
    const asked = turns[turns.length - 1];
    const label = /„([^“]+)“/.exec(asked)?.[1] ?? "this method";
    return `${label} would lay out, for your project, what is known and what is still open. ` +
      `So far I only have: “${gist(first)}”. ${demo}\n[[CHOICES: Tell me more|Change it|Back to the methods]]`;
  }

  const answers = kinds.filter((k, i) => i > kinds.lastIndexOf("optimize") && (k === "answer" || k === "skip")).length;
  if (kinds.includes("optimize")) {
    const station = answers;
    if (station >= total) {
      return `That covers every method. Shall I write the ${d.title} now? ${demo}\n[[CHOICES: Create the ${d.title}|One more question]]${marks(d, total - 1).replace(/\[\[PROGRESS: \d+\]\]/, "[[PROGRESS: 100]]")}`;
    }
    const s = d.stations[station];
    return `${station === 0 ? "Let's sharpen the methods. " : "Thanks, noted. "}${s.goal} ${demo}${marks(d, station)}`;
  }

  // The first message: a draft of every method, no interview.
  const lines = d.stations.slice(0, 6).map(s => `- **${s.label}** — ${s.goal}`).join("\n");
  return `Here is a first draft from what you wrote (“${gist(first)}”):\n\n${lines}\n\n` +
    `${demo}\n[[CHOICES: Optimize all methods|Open one method]]`;
}

/** The pretend Assistant (the Coach column). */
export function fakeAssistantReply(): string {
  return "I am reading along with your consultant. Nothing to add yet. (Demo mode: a pretend answer, no model was asked.)\n[[CHOICES: What should I do next?|All good for now]]";
}

export function fakeReplyFor(role: "consultant" | "coach", kind: string | null, turns: string[]): string {
  return role === "coach" ? fakeAssistantReply() : fakeConsultantReply(turns, deliverableFor("consultant", kind));
}

/** The reply as a stream of small pieces, so the chat shows it arriving. */
export function fakeStream(text: string, onDone: () => Promise<void> | void): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const parts = text.match(/[\s\S]{1,18}/g) ?? [];
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i < parts.length) {
        await new Promise(r => setTimeout(r, 18));
        controller.enqueue(enc.encode(parts[i++]));
      } else {
        await onDone();
        controller.close();
      }
    },
  });
}
