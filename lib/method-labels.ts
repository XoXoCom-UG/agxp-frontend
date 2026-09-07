// The seeded method rows carry German-ish names ("Gap-Analyse"); the approved
// UI template labels them in English. Display-only mapping — no migration, the
// DB stays the single source of truth for what a method *is*.
const LABELS: Record<string, string> = {
  "As-Is/To-Be": "As-Is / To-Be",
  "Gap-Analyse": "Gap Analysis",
};

const BLURBS: Record<string, string> = {
  "As-Is/To-Be": "Map current vs. target state.",
  "Gap-Analyse": "Compare current vs. target state.",
  "Requirements Engineering": "Structure project requirements.",
  "Process Mapping": "Visualize the existing process flow.",
  "Impact Mapping": "Link goals to measurable impact.",
};

export function methodLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function methodBlurb(name: string): string {
  return BLURBS[name] ?? "Apply this method to the project.";
}
