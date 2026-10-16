"use client";

import { useMemo } from "react";
import type { PanelSnapshot } from "@/lib/peer-context";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import type { Deliverable } from "@/lib/deliverables";
import { md, handleCodeCopyClick } from "@/lib/markdown";
import { ArtifactActions, versionLine } from "@/components/layout/deliverable-rail";
import { IconCheck, IconMinimise, IconSpark } from "@/components/layout/agxp-icons";

/** How far the interview has to be before the document can be asked for. */
const GENERATE_FROM_PCT = 60;

/**
 * The right-hand side of the workspace, when it is not the Coach.
 *
 * Agreed with Patryk on 2026-10-09 (01:01:46): a newcomer who sees a
 * Consultant on the left and a Coach on the right is asked to understand two
 * agents before doing anything, so the right side opens on what is being
 * BUILT instead, and the Coach is one tab away.
 *
 * Two states, and the first replaces the second (Ana, 2026-10-15):
 *   - while the interview runs: the progress card and every question, always
 *     in view, the one being worked on breathing;
 *   - once the Transformation Concept exists: the questions are gone, the
 *     header carries the version and its actions, and the document itself fills
 *     the panel.
 *
 * Methods that fill in live while the user talks need their own marker in the
 * chat protocol and come in a later phase.
 */
export function MethodsPanel({ tabs, deliverable, snap, onOpenDoc, onMinimise }: {
  /** Methods or Coach — drawn in the header, inside the card. */
  tabs?: React.ReactNode;
  /** What the Consultant is working toward — its title and its questions. It
   *  depends on the agent's type, so the screen works it out. */
  deliverable: Deliverable;
  /** What the Consultant's panel last published: progress, document, controls. */
  snap: PanelSnapshot | undefined;
  /** Opens the document in the full reading view. */
  onOpenDoc: (doc: DeliverableDoc) => void;
  onMinimise?: () => void;
}) {
  const d = deliverable;
  const rail = snap?.rail;
  const controls = snap?.controls;
  const doc = rail?.currentDoc ?? null;

  // A plan may cover fewer stations than the full agenda; the agent says how many.
  const stations = d.stations.slice(0, rail?.totalStations ?? d.stations.length);
  const finished = !!doc;
  // Before the first answer the first question is the one being worked on.
  const nowIdx = finished ? -1 : Math.max(0, rail?.stationIdx ?? 0);

  const html = useMemo(() => (doc ? md(doc.content) : ""), [doc]);

  return (
    <section className={`panel methods-panel${finished ? " is-ready" : ""}`} aria-labelledby="mp-title">
      <header className="mp-head">
        <div className="mp-head-row">
          {tabs}
          {onMinimise && (
            <button className="head-min mp-tool" onClick={onMinimise}
              data-tooltip="Fold away" aria-label="Fold this panel away">
              <IconMinimise size={14} />
            </button>
          )}
        </div>
        <div className="mp-head-txt">
          <h2 id="mp-title" className="mp-title">{d.title}</h2>
          {/* Only the version, once there is one. Before that the title stands alone. */}
          {doc && rail && <p className="mp-sub">{versionLine(rail.version, doc.createdAt, rail.restored)}</p>}
        </div>

        {doc && rail && controls && (
          <div className="mp-actions" data-tour="rail">
            <ArtifactActions
              sending={snap?.busy ?? false}
              versions={rail.versions}
              current={rail.version}
              onOpen={() => onOpenDoc(doc)}
              onRegenerate={controls.regenerate}
              onOpenVersion={controls.openVersion}
              onRestoreVersion={controls.restoreVersion}
            />
          </div>
        )}
      </header>

      <div className="mp-body">
        {!finished && rail && controls && (
          <div className="mp-progress" data-tour="rail">
            <div className="mp-progress-row">
              <span className="mp-progress-step">
                {rail.stationIdx < 0
                  ? `${rail.totalStations} steps · not started`
                  : `Step ${rail.stationIdx + 1} of ${rail.totalStations} · ${rail.stationLabel}`}
              </span>
              <span className="mp-progress-pct">{Math.round(snap?.pct ?? 0)}%</span>
            </div>
            <div className="artf-bar" style={{ ["--dr-steps" as string]: rail.totalStations }}>
              <span style={{ ["--p" as string]: `${Math.max(0, Math.min(100, snap?.pct ?? 0))}%` }} />
            </div>
            {/* Only once there is enough to write from: a Generate button at 0%
                asks for a document out of nothing. */}
            {(snap?.pct ?? 0) >= GENERATE_FROM_PCT && (
              <button className="artf-cta mp-generate" disabled={snap?.busy ?? false} onClick={controls.generate}>
                <IconSpark size={12} />Generate
              </button>
            )}
          </div>
        )}

        {!finished && (
          <ol className="mp-steps">
            {stations.map((s, i) => {
              const state = i < nowIdx ? "done" : i === nowIdx ? "now" : "todo";
              return (
                <li key={s.label} className={`mp-step ${state}`} aria-current={state === "now" ? "step" : undefined}>
                  <span className="mp-node" aria-hidden="true">
                    {state === "done" && <IconCheck size={11} />}
                  </span>
                  <span className="mp-step-l">{s.label}</span>
                  <span className="visually-hidden">{state === "done" ? ", done" : state === "now" ? ", in progress" : ", not yet"}</span>
                </li>
              );
            })}
          </ol>
        )}

        {doc && (
          <div className="mp-doc" onClick={handleCodeCopyClick}>
            <div className="doc-sheet">
              <div className="doc-body" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
