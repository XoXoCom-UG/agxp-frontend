/**
 * Which industry ("Branche") a project is in — shown on the Agent Dashboard
 * next to an agent's projects and tokens (Patryk, 2026-09-30: "Branche, also
 * z.B. Bank oder Software").
 *
 * Nothing stores it. Two sources, best first:
 *  1. the agent names it with an [[INDUSTRY: …]] marker (asked for in the
 *     chat route's system prompt, parsed in message-markers.ts) — only in
 *     conversations from 2026-10-01 on;
 *  2. otherwise it is recognised from what the user wrote, by the keywords
 *     below — which is what gives older projects an industry at all.
 *
 * Keywords are whole words or word starts in German, English and Romanian.
 * Word boundaries matter: "Datenbank" must not read as banking.
 */

/**
 * A whole word (or word start, with \p{L}*) in any alphabet. JavaScript's \b
 * only knows ASCII letters, so "bancă" would never end a word with it.
 */
function word(alternatives: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");
}

const INDUSTRIES: { label: string; re: RegExp }[] = [
  { label: "Banking", re: word(String.raw`bank(en|ing|wesen)?|sparkasse\p{L}*|fintech|banc[aă]\p{L}*`) },
  { label: "Insurance", re: word(String.raw`versicherung\p{L}*|insurance|insurer\p{L}*|asigur[aă]r\p{L}*`) },
  { label: "Logistics", re: word(String.raw`logisti\p{L}*|spedition\p{L}*|freight|shipping|transportunternehm\p{L}*`) },
  { label: "Retail", re: word(String.raw`einzelhandel\p{L}*|retail\p{L}*|supermarkt\p{L}*|retailer\p{L}*`) },
  { label: "E-commerce", re: word(String.raw`e-?commerce|online-?shop\p{L}*|webshop\p{L}*`) },
  { label: "Healthcare", re: word(String.raw`gesundheitswesen|krankenh[aä]us\p{L}*|klinik\p{L}*|healthcare|hospital\p{L}*|pharma\p{L}*|spital\p{L}*`) },
  { label: "Software & IT", re: word(String.raw`software\p{L}*|saas|it-dienstleist\p{L}*|it-unternehm\p{L}*`) },
  { label: "Automotive", re: word(String.raw`automotive|automobil\p{L}*|autohaus\p{L}*|autohändler\p{L}*|car dealer\p{L}*`) },
  { label: "Manufacturing", re: word(String.raw`maschinenbau\p{L}*|fertigung\p{L}*|manufactur\p{L}*|fabrik\p{L}*|produktionsbetrieb\p{L}*`) },
  { label: "Energy", re: word(String.raw`energieversorg\p{L}*|stadtwerke|energy|utilities|energie\p{L}*`) },
  { label: "Public sector", re: word(String.raw`behörde\p{L}*|öffentliche[nr]? verwaltung|public sector|government|kommunalverwaltung\p{L}*`) },
  { label: "Telecom", re: word(String.raw`telekommunikation\p{L}*|telecom\p{L}*|mobilfunk\p{L}*`) },
  { label: "Education", re: word(String.raw`schule\p{L}*|hochschule\p{L}*|universit\p{L}*|education|bildungs\p{L}*`) },
  { label: "Real estate", re: word(String.raw`immobilie\p{L}*|real estate|hausverwaltung\p{L}*`) },
  { label: "Hospitality", re: word(String.raw`hotel\p{L}*|gastronomie\p{L}*|restaurant\p{L}*|tourismus|hospitality`) },
  { label: "Media", re: word(String.raw`medienhaus\p{L}*|verlag\p{L}*|publishing|media company`) },
];

/** Every industry the text mentions, most mentions first. */
export function detectIndustries(text: string): string[] {
  const hits: { label: string; n: number }[] = [];
  for (const { label, re } of INDUSTRIES) {
    const n = text.match(new RegExp(re.source, "giu"))?.length ?? 0;
    if (n) hits.push({ label, n });
  }
  return hits.sort((a, b) => b.n - a.n).map(h => h.label);
}

/** The labels, most frequent first, from a list that may repeat. */
export function rankIndustries(labels: string[]): string[] {
  const count = new Map<string, number>();
  for (const l of labels) count.set(l, (count.get(l) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}
