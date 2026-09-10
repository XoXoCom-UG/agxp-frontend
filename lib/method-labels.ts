// The seeded method rows carry consulting jargon ("Gap-Analyse"). Patryk's
// review (2026-09-10): someone with no IT or consulting background must not
// hit foreign words on the first screen. So the DB keeps the technical name
// and this is where it turns into something anyone understands.
const LABELS: Record<string, string> = {
  "As-Is/To-Be": "Where you are, where you want to be",
  "Gap-Analyse": "What is missing",
  "Requirements Engineering": "What you actually need",
  "Process Mapping": "Your steps, written down",
  "Impact Mapping": "What will change",
};

const BLURBS: Record<string, string> = {
  "As-Is/To-Be": "Compare today with your goal.",
  "Gap-Analyse": "Find what stands between the two.",
  "Requirements Engineering": "Turn wishes into clear requirements.",
  "Process Mapping": "Write down how the work runs today.",
  "Impact Mapping": "See who and what a change touches.",
};

export function methodLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function methodBlurb(name: string): string {
  return BLURBS[name] ?? "Work through this together.";
}
