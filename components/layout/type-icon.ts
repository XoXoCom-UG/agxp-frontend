import {
  IconChart, IconNodes, IconDoc, IconRefresh, IconUsers, IconList, IconSwap, IconSpark, IconUser, IconFolder, IconGear,
} from "@/components/layout/agxp-icons";

/** A glyph per agent type, keyed by the template's name (lib/agent-types.ts).
 *  Used by the picker's type tiles and type bands. */
export const TYPE_ICON: Record<string, typeof IconChart> = {
  "Strategy Consultant": IconChart,
  "Business Analyst": IconList,
  "Digital Transformation Manager": IconSwap,
  "Data Scientist": IconSpark,
  "Product Manager": IconUser,
  "Solution Architect": IconNodes,
  "Enterprise Architect": IconFolder,
  "Startup CTO": IconGear,
  "AI Business Analyst": IconDoc,
  "Agile Coach / Scrum Master": IconRefresh,
  "Change Manager": IconUsers,
};
