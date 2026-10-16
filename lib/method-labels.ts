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
  // The method sheet of 2026-10-16 (the three consultant types).
  "Knowledge Check": "Where you start",
  "Lexicon": "The words, explained",
  "At a Glance": "The case in one table",
  "Gap Analysis + Action Plan": "What is missing, and what to do",
  "Market / Opportunity Gaps": "Where the market has room",
  "Build / Buy / Partner Matrix": "Build, buy or team up",
  "SMART Goals": "Goals you can check",
  "SWOT": "Strengths and risks of the plan",
  "Architecture Overview": "The parts and how they connect",
  "Tech Stack Decisions (ADR)": "Why each tool was chosen",
  "Non-Functional Requirements": "How well it must work",
  "Data & ML Pipeline": "From data to a running model",
  "Infrastructure Plan": "Where it runs",
  "Cost Model (TCO)": "What it really costs",
  "Risk Register": "What could go wrong",
  "Stakeholder Map": "Who is affected",
  "Skill-Gap Analysis": "What people need to learn",
  "ADKAR Assessment": "Where the change gets stuck",
  "Role Matrix": "What changes in each role",
  "Training & Communication Plan": "Who hears what, and when",
  "Adoption KPIs": "How you know it is used",
};

const BLURBS: Record<string, string> = {
  "As-Is/To-Be": "Compare today with your goal.",
  "Gap-Analyse": "Find what stands between the two.",
  "Requirements Engineering": "Turn wishes into clear requirements.",
  "Process Mapping": "Write down how the work runs today.",
  "Impact Mapping": "See who and what a change touches.",
  "Knowledge Check": "Three quick questions set how deep it goes.",
  "Lexicon": "Every foreign term, in plain language.",
  "At a Glance": "The whole project in seconds.",
  "Gap Analysis + Action Plan": "Where you are, where you want to be, and the steps between.",
  "Market / Opportunity Gaps": "Demand nobody serves yet.",
  "Build / Buy / Partner Matrix": "Decide per capability what to make yourself.",
  "SMART Goals": "Every goal answered with yes or no.",
  "SWOT": "Strengths, weaknesses, chances and threats.",
  "Architecture Overview": "Components, their job and who talks to whom.",
  "Tech Stack Decisions (ADR)": "Every big choice, with the options and the reason.",
  "Non-Functional Requirements": "Speed, scale, security and uptime, measured.",
  "Data & ML Pipeline": "Ingest, train, serve, and watch for drift.",
  "Infrastructure Plan": "Cloud, on-premises or both, and why.",
  "Cost Model (TCO)": "One-time and monthly costs, people's time included.",
  "Risk Register": "Named risks, rated, each with a countermeasure.",
  "Stakeholder Map": "Groups by interest and influence, and how to involve them.",
  "Skill-Gap Analysis": "Skills per group, today against target.",
  "ADKAR Assessment": "Five stages per group; the first weak one is the blocker.",
  "Role Matrix": "Today, after the change, and what stays the same.",
  "Training & Communication Plan": "Messages and training in the right order.",
  "Adoption KPIs": "Usage measures with targets and deadlines.",
};

export function methodLabel(name: string): string {
  return LABELS[name] ?? name;
}

export function methodBlurb(name: string): string {
  return BLURBS[name] ?? "Work through this together.";
}
