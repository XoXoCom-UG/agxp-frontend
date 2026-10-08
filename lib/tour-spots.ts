"use client";

/**
 * The walk-through that points at the real screen.
 *
 * The concept tour (lib/tour.ts) answers "what is this app for". This one
 * answers "where do I press", and it is the half that has to survive the
 * layout changing, so two rules hold it together:
 *
 * 1. Every target is found by `data-tour="<id>"` on the real element, never
 *    by a CSS class. Classes are styling and they get renamed; a data
 *    attribute is a contract, and grepping for one finds every anchor.
 * 2. A target that is not on screen is SKIPPED, not pointed at. Half of
 *    these only exist in some states — the composer needs an agent chosen,
 *    the plan badge needs an entitlement loaded — and a tour that highlights
 *    a rectangle at 0,0 because its anchor never rendered is worse than a
 *    tour with one step fewer.
 */

export type Side = "top" | "bottom" | "left" | "right";

export interface Spot {
  /** Matches `data-tour` on the real element. */
  anchor: string;
  title: string;
  body: string;
  /** Where the bubble would like to sit. It moves if it does not fit. */
  prefer: Side;
}

/**
 * In the order you meet them: what is in front of you, then the two panels,
 * then how you talk to them, then where the result comes out, then the
 * things around the edge.
 */
export const TOUR_SPOTS: Spot[] = [
  {
    anchor: "new-task",
    title: "Start a task here",
    body: "Every piece of work begins here. Nothing is created until you actually pick an agent, so pressing it costs nothing.",
    prefer: "bottom",
  },
  {
    anchor: "panel-consultant",
    title: "Your Consultant sits on this side",
    body: "This half is one conversation, working toward the Transformation Concept.",
    prefer: "right",
  },
  {
    anchor: "panel-coach",
    title: "Your Coach sits on this one",
    body: "The other half, the other document — the Change Plan. Both stay live; switching between them never loses what you typed.",
    prefer: "left",
  },
  {
    anchor: "composer",
    title: "Answer here",
    body: "Type, or press one of the suggested answers above the box. The paper clip takes PDFs and images — the agents read them directly.",
    prefer: "top",
  },
  {
    anchor: "rail",
    title: "How far along you are",
    body: "The stations of the interview, and the document as it fills in. This is also where you generate it once there is enough.",
    prefer: "left",
  },
  {
    anchor: "history",
    title: "Everything you have worked on",
    body: "Past projects, their documents, and what state each one is in.",
    prefer: "bottom",
  },
  {
    anchor: "agents",
    title: "The agents you have trained",
    body: "They level up with every project you finish together, and carry what they learned into the next one.",
    prefer: "bottom",
  },
  {
    anchor: "plan",
    title: "What is left of your plan",
    body: "How many projects you have used. It turns into a link to the plan when you are close.",
    prefer: "bottom",
  },
  {
    anchor: "account",
    title: "You, and how it all looks",
    body: "Your name, the colour, light or dark — and this tour, whenever you want it again.",
    prefer: "left",
  },
];

/* --- Where the bubble goes ------------------------------------------------ */

export interface Rect { x: number; y: number; width: number; height: number }
export interface Box { width: number; height: number }
export interface Placed { left: number; top: number; side: Side }

/** Breathing room between the highlighted thing and the bubble. */
export const GAP = 14;
/** How close to the window edge the bubble may come. */
const EDGE = 10;

/**
 * Put the bubble beside the target, on the preferred side if it fits and on
 * the best of the others if it does not.
 *
 * Pure, and separated from the component on purpose: this is the part with
 * the arithmetic, the part that silently puts a panel half off-screen on a
 * laptop nobody tested on, and the only part worth testing. The component
 * measures and renders; the decision lives here.
 */
export function placeBubble(
  target: Rect, bubble: Box, view: Box, prefer: Side, gap: number = GAP,
): Placed {
  const room: Record<Side, number> = {
    top: target.y,
    bottom: view.height - (target.y + target.height),
    left: target.x,
    right: view.width - (target.x + target.width),
  };
  const need = (s: Side) => (s === "top" || s === "bottom" ? bubble.height : bubble.width) + gap;

  // The preferred side, then its opposite, then whichever has the most room.
  // Opposite first because a flip keeps the bubble on the same axis, which
  // reads as the same tour rather than as the panel jumping around.
  const order: Side[] = [prefer, OPPOSITE[prefer], ...SIDES.filter(s => s !== prefer && s !== OPPOSITE[prefer])];
  const side = order.find(s => room[s] >= need(s))
    // Nothing fits — a phone, usually. Take the roomiest and let the clamp
    // below keep it on screen; overlapping the target beats being off it.
    ?? SIDES.reduce((a, b) => (room[a] >= room[b] ? a : b));

  let left: number, top: number;
  if (side === "top" || side === "bottom") {
    left = target.x + target.width / 2 - bubble.width / 2;
    top = side === "top" ? target.y - gap - bubble.height : target.y + target.height + gap;
  } else {
    top = target.y + target.height / 2 - bubble.height / 2;
    left = side === "left" ? target.x - gap - bubble.width : target.x + target.width + gap;
  }

  return { side, left: clamp(left, bubble.width, view.width), top: clamp(top, bubble.height, view.height) };
}

const SIDES: Side[] = ["bottom", "top", "right", "left"];
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/** Keeps an edge inside the window — and, when the bubble is simply bigger
 *  than the window, pins it to the top/left rather than pushing it past both
 *  edges at once. */
function clamp(v: number, size: number, limit: number): number {
  const max = limit - size - EDGE;
  if (max <= EDGE) return EDGE;
  return Math.max(EDGE, Math.min(v, max));
}
