import {
  IconChart, IconNodes, IconGear, IconDoc, IconRefresh, IconUsers,
} from "@/components/layout/agxp-icons";

/** A glyph per agent type, keyed by the template's name (lib/agent-types.ts).
 *  Used by the picker's type tiles and type bands. */
export const TYPE_ICON: Record<string, typeof IconChart> = {
  "AI Strategy Consultant": IconChart,
  "Solution Architect": IconNodes,
  "Digital Transformation Manager": IconGear,
  "AI Business Analyst": IconDoc,
  "Agile Coach / Scrum Master": IconRefresh,
  "Change Manager": IconUsers,
};
