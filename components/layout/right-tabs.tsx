"use client";

import { useT } from "@/lib/language";

export type RightView = "methods" | "coach";

/**
 * Methods or Coach: the choice for the right-hand side of the workspace.
 *
 * It lives INSIDE the panel it switches (in the Methods header, in the Coach's
 * head, on the Coach's picker) rather than above it, so the right-hand card
 * starts at the same height as the Consultant's (Ana, 2026-10-15).
 */
export function RightTabs({ view, onChange, coachUnseen = false }: {
  view: RightView;
  onChange: (view: RightView) => void;
  /** The Coach has said something while it was out of sight. */
  coachUnseen?: boolean;
}) {
  const t = useT();
  return (
    <div className="rt-tabs" role="group" aria-label={t("Show on this side")} data-tour="panel-switch">
      <button type="button" className="rt-tab" aria-pressed={view === "methods"}
        onClick={() => onChange("methods")}>{t("Methods")}</button>
      <button type="button" className="rt-tab" aria-pressed={view === "coach"}
        onClick={() => onChange("coach")}>
        {t("Coach")}
        {coachUnseen && (
          <><span className="rt-dot" aria-hidden="true" /><span className="visually-hidden">{t(", has something to add")}</span></>
        )}
      </button>
    </div>
  );
}
