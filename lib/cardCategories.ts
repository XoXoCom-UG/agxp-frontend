/**
 * Mirror of src/agent/card_categories.py in the backend.
 *
 * If you add a category there, add it here too — the two are exchanged by id
 * over the API, so they must not diverge. `generic` is the safety net and must
 * always exist.
 */

export const CARD_CATEGORIES = [
  { id: "cost_roi", label: "Kosten & ROI" },
  { id: "security_compliance", label: "Security & Compliance" },
  { id: "performance_scalability", label: "Performance & Skalierung" },
  { id: "reliability_monitoring", label: "Zuverlässigkeit & Monitoring" },
  { id: "dev_productivity", label: "Developer Experience & Produktivität" },
  { id: "generic", label: "Allgemein" },
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number]["id"];

export const CARD_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CARD_CATEGORIES.map(c => [c.id, c.label])
);

export const FALLBACK_CATEGORY: CardCategory = "generic";
