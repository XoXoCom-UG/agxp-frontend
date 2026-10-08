"use client";

/**
 * The guided tour — what it is made of, and whether you have seen it.
 *
 * Shown once, right after the first sign-in, and replayable from Settings
 * forever after. Nothing here renders: the steps are data so the component
 * stays a renderer and the copy can be read, reviewed and changed in one
 * place, the same discipline as lib/deliverables.ts.
 *
 * WHERE THE FLAG LIVES, and why that is allowed here.
 *
 * In the account's own `user_metadata`, which lib/auth-context.tsx writes
 * straight from the browser — so the user can set it to anything they like.
 * The plan deliberately does NOT live there for exactly that reason
 * (lib/plans.ts: a plan you can write is a plan you can set to `max`). The
 * difference is what a forged value buys: here, the worst case is that
 * someone re-watches, or skips, their own tutorial. There is nothing to
 * steal, so metadata is the right home and it costs no table, no policy and
 * no migration — and unlike localStorage it follows you to a second machine,
 * which is the whole point of "shown once".
 *
 * localStorage mirrors it anyway, for two cases metadata cannot cover: the
 * decision has to be made before the write round-trips, and a write that
 * fails (offline, blocked) must not replay the tour on every single load.
 */

import type { AgentType } from "@/lib/agents";

/**
 * Bumped when the tour changes enough that people who saw the old one should
 * see it again. A stored number lower than this counts as unseen; equal or
 * higher counts as seen, so a version rollback does not re-nag everybody.
 */
export const TOUR_VERSION = 1;

/** The metadata key on the account, and the mirror key in this browser. */
export const TOUR_META_KEY = "agxp_tour";
const LOCAL_KEY = "agxp.tour";

/* --- Has this person seen it? --------------------------------------------- */

/**
 * The whole decision, as a pure function of the two stored values, so the
 * awkward cases are testable without a browser or a session: a string where a
 * number was expected, a future version, a value from a half-finished write.
 *
 * Either side saying "seen" is enough. They disagree whenever a write failed
 * or a second machine is involved, and in both of those the honest reading of
 * one "yes" is yes — showing the tour to someone who has already sat through
 * it is the worse mistake of the two.
 */
export function tourSeen(metaValue: unknown, localValue: string | null): boolean {
  return asVersion(metaValue) >= TOUR_VERSION || asVersion(localValue) >= TOUR_VERSION;
}

/** -1 for anything that is not a real version, so it reads as "never seen". */
function asVersion(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : -1;
}

/** This browser's half of the answer. Safe where storage is blocked. */
export function readLocalTour(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
}

/** Writes this browser's half. The account's half is the caller's job —
 *  it needs a Supabase client, and this module deliberately has none. */
export function writeLocalTour(version: number = TOUR_VERSION): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, String(version));
  } catch {
    // Private mode. The account metadata is still written, so the next load
    // on a working browser settles it.
  }
}

/** Forgets it in this browser, so Settings → Replay works even offline. */
export function clearLocalTour(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Nothing to do; the replay button drives the tour directly anyway.
  }
}

/* --- The steps ------------------------------------------------------------ */

/**
 * Which live demonstration sits beside the words. Not a picture of the app —
 * a working miniature of the real thing, so the step is something you watch
 * happen rather than something you are told about. `paint` is the only one
 * wired to the real app: it changes the actual colours while you look at it.
 */
export type Scene = "hello" | "pair" | "ask" | "build" | "memory" | "paint" | "go";

export interface TourStep {
  id: Scene;
  /** The word on the progress rail. One word, so six of them fit on a phone. */
  tag: string;
  /** Big. Reads on its own, with no body text. */
  title: string;
  /** One sentence. If it needs two, the step is doing too much. */
  line: string;
  /** Who is talking, if anyone — the face that leans in on this step. */
  speaker?: AgentType;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "hello",
    tag: "Hello",
    title: "You are not alone in here.",
    line: "Two agents work your transformation with you — this takes about a minute, and you can leave at any point.",
  },
  {
    id: "pair",
    tag: "The pair",
    title: "One plans the work. One plans the people.",
    line: "The Consultant writes your Transformation Concept, the Coach writes your Change Plan — side by side, on the same screen.",
    speaker: "consultant",
  },
  {
    id: "ask",
    tag: "Talking",
    title: "One question at a time.",
    line: "No forms. They interview you, and when a question has obvious answers you get them as buttons — try one.",
    speaker: "coach",
  },
  {
    id: "build",
    tag: "The doc",
    title: "The document writes itself while you talk.",
    line: "Each conversation walks a set number of stations, and what you say turns into charts rather than paragraphs.",
    speaker: "consultant",
  },
  {
    id: "memory",
    tag: "Memory",
    title: "They remember the last project.",
    line: "What an agent learns working with you comes along to your next project, so you never start from nothing twice.",
    speaker: "coach",
  },
  {
    id: "paint",
    tag: "Your look",
    title: "Make it yours. Right now.",
    line: "Pick a colour and watch the whole app follow — this is the real setting, not a preview of one.",
  },
  {
    id: "go",
    tag: "Ready",
    title: "That is the whole thing.",
    line: "Start a project whenever you like. This tour lives in Settings → Profile if you ever want it again.",
  },
];

/* --- The miniature conversation, used by the "ask" scene ------------------- */

/** Written out rather than generated: it has to read like a real interview,
 *  and three hand-written lines do that better than any template. */
export const TOUR_CHOICES = ["Logistics", "Manufacturing", "Healthcare"];
export const TOUR_QUESTION = "Which industry are we working in?";
export const TOUR_REPLIES: Record<string, string> = {
  Logistics: "Good — then let us start with the dispatch desk. How does an order reach you today?",
  Manufacturing: "Good — then let us start on the shop floor. Where does a job first get written down?",
  Healthcare: "Good — then let us start with the ward. Who records a patient's details first?",
};
