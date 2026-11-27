import { parseMarkers } from "./message-markers.ts";
import { discussedMethod, cockpitStation, isJumpCommand } from "./deliverables.ts";

/**
 * What the Cockpit remembers about each method, read back from the stored
 * conversation instead of kept in component state (2026-11-27): which methods
 * the person has talked through, and which ones "Start here" jumped over and
 * left open. In state they were gone after a reload; the conversation is the
 * record, so the Cockpit reads them from it every time.
 *
 * Relative imports only: the tests run under plain node.
 */
export interface CockpitHistory {
  /** Methods opened with "Talk it through" at least once. */
  talked: string[];
  /** Stations a jump passed over that the interview has not come back to. */
  leftOpen: string[];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function cockpitHistory(
  messages: { role: string; content: string }[],
  stations: { label: string }[],
): CockpitHistory {
  const talked = new Set<string>();
  const leftOpen = new Set<string>();
  const indexOf = (label: string) => stations.findIndex(s => same(s.label, label));
  /** The station the interview was on at this point of the conversation. */
  let now = -1;

  for (const m of messages) {
    if (m.role === "user") {
      const discussed = discussedMethod(m.content);
      if (discussed) {
        const i = indexOf(discussed);
        if (i >= 0) talked.add(stations[i].label);
        continue;
      }
      if (isJumpCommand(m.content)) {
        const target = indexOf(cockpitStation(m.content));
        if (target < 0) continue;
        for (let k = Math.max(0, now); k < target; k++) leftOpen.add(stations[k].label);
        leftOpen.delete(stations[target].label);
      }
      continue;
    }
    if (m.role !== "assistant") continue;
    const topic = parseMarkers(m.content).topic;
    if (!topic) continue;
    const byLabel = indexOf(topic.label);
    now = byLabel >= 0 ? byLabel : Math.min(stations.length - 1, topic.index - 1);
    // The interview came back to a station it had left open: it is being done now.
    if (now >= 0) leftOpen.delete(stations[now].label);
  }

  const order = (set: Set<string>) => stations.map(s => s.label).filter(l => set.has(l));
  return { talked: order(talked), leftOpen: order(leftOpen) };
}
