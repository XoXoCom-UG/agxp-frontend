"use client";
import { motion } from "motion/react";
import { Check, MessageSquare, Zap, Map } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Where you are in a project: Interview → Konzept → Roadmap.
 *
 * "Starte Projekt" promises those three stages on the button and then never
 * mentions them again — the interview runs twelve to fifteen questions with no
 * sense of progress, and once a concept exists nothing says a roadmap comes next.
 * This keeps the promise on screen for the whole run.
 *
 * Every state is derived from something real (does a concept exist, does a roadmap
 * exist), never from a counter we increment ourselves — a progress bar that can
 * disagree with the data is worse than none. Question numbers are deliberately
 * absent: Patryk asked for sections announced in a sentence, not "5/15".
 */

export type JourneyStage = "interview" | "concept" | "roadmap";

const STAGES: { id: JourneyStage; label: string; hint: string; Icon: React.ElementType }[] = [
  { id: "interview", label: "Interview", hint: "Fragen zu deinem Vorhaben", Icon: MessageSquare },
  { id: "concept",   label: "Konzept",   hint: "Ist/Ziel, Maßnahmen, Kennzahlen", Icon: Zap },
  { id: "roadmap",   label: "Roadmap",   hint: "Phasen, Tools, Reihenfolge", Icon: Map },
];

export function ProjectJourney({
  hasMessages, hasConcept, hasRoadmap, onOpen, variant = "bar",
}: {
  hasMessages: boolean;
  hasConcept: boolean;
  hasRoadmap: boolean;
  /** Only passed for stages already reachable — an upcoming stage isn't clickable. */
  onOpen?: (stage: JourneyStage) => void;
  /** "bar" rides above the conversation; "preview" introduces the three stages
   *  before the first message, so the button's promise lands somewhere. */
  variant?: "bar" | "preview";
}) {
  const done: Record<JourneyStage, boolean> = {
    interview: hasConcept,                 // the interview's output IS the concept
    concept: hasConcept,
    roadmap: hasRoadmap,
  };
  const current: JourneyStage = !hasConcept ? "interview" : !hasRoadmap ? "concept" : "roadmap";
  const reachable: Record<JourneyStage, boolean> = {
    interview: hasMessages,
    concept: hasConcept,
    roadmap: hasConcept,                   // reachable as soon as a concept exists
  };

  const preview = variant === "preview";

  return (
    <div
      className={cn(
        "no-print flex",
        // Three side-by-side cards with descriptions don't fit a phone — they
        // clipped the last one. Stacked below sm, side by side from there.
        preview ? "flex-col sm:flex-row sm:items-stretch gap-2 w-full" : "items-stretch gap-1.5"
      )}
      aria-label="Projektverlauf"
    >
      {STAGES.map((s, i) => {
        const isDone = done[s.id] && s.id !== current;
        const isCurrent = s.id === current;
        const canOpen = reachable[s.id] && !!onOpen;

        const body = (
          <>
            <span
              className={cn(
                "flex items-center justify-center rounded-lg shrink-0 transition-colors duration-200",
                preview ? "w-7 h-7" : "w-5 h-5",
                isDone
                  ? "bg-green-600 text-white"
                  : isCurrent
                    ? "bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-900"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
              )}
            >
              {isDone
                ? <Check className={preview ? "w-4 h-4" : "w-3 h-3"} strokeWidth={2.6} />
                : <s.Icon className={preview ? "w-3.5 h-3.5" : "w-3 h-3"} strokeWidth={1.8} />}
            </span>

            <span className="min-w-0 text-left">
              <span
                className={cn(
                  "block font-semibold leading-none truncate",
                  preview ? "text-[12.5px]" : "text-[11.5px]",
                  isCurrent
                    ? "text-green-700 dark:text-green-400"
                    : isDone
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400"
                )}
              >
                {s.label}
              </span>
              {preview && (
                <span className="block text-[10.5px] text-zinc-400 mt-1 leading-snug">{s.hint}</span>
              )}
            </span>

            {/* A quiet pulse marks the stage you're actually in. */}
            {isCurrent && !preview && (
              <motion.span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
            )}
          </>
        );

        return (
          <div key={s.id} className={cn("flex items-center gap-1.5", preview && "flex-1 min-w-0")}>
            {canOpen ? (
              <button
                type="button"
                onClick={() => onOpen?.(s.id)}
                title={`${s.label} öffnen`}
                className={cn(
                  "flex items-center gap-2 rounded-xl transition-colors duration-150 min-w-0",
                  preview
                    ? "w-full px-3 py-2.5 border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    : "px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                {body}
              </button>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-2 min-w-0",
                  preview
                    ? "w-full px-3 py-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    : "px-2 py-1"
                )}
              >
                {body}
              </div>
            )}

            {i < STAGES.length - 1 && !preview && (
              <span aria-hidden className="w-4 h-px bg-zinc-200 dark:bg-zinc-700 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
