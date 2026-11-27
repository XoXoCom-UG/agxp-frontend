"use client";

import { useState } from "react";
import type { Agent } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { assignAgent } from "@/lib/projects";
import { templateFor } from "@/lib/agent-types";
import { experienceFor } from "@/lib/agent-level";
import { useMascotLevels } from "@/lib/mascot-level";
import { addAssistant } from "@/lib/start-flow";
import { describeDbError } from "@/lib/db-error";
import { useT } from "@/lib/language";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { PromptPad, type Activation } from "@/components/layout/prompt-pad";
import type { DraftState } from "@/lib/method-draft";
import { IconAlert, IconArrow, IconBack } from "@/components/layout/agxp-icons";

/**
 * A project that is open but has no consultant on it — after "Change agent",
 * or one whose consultant is gone (2026-11-27). It used to fall back to the old
 * picker ("Create new AI consultant / Train one of your AI team members"),
 * which belongs to the app before the Prompt Pad. Now: the person's own
 * consultants as big rows to tap, or "describe it and let me choose", which
 * is the Prompt Pad for this same project.
 */
export function ConsultantSwitch({ project, agents, onAssigned, onActivate, onDraft }: {
  project: Project;
  agents: Agent[];
  onAssigned: (p: Project) => void;
  /** The Prompt Pad's Start, into this project. */
  onActivate: (a: Activation) => Promise<void>;
  onDraft?: (d: DraftState | null) => void;
}) {
  const tr = useT();
  const levels = useMascotLevels();
  const [describe, setDescribe] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mine = agents
    .filter(a => a.type === "consultant" && !a.archived_at)
    .sort((a, b) => (levels[b.id] ?? 1) - (levels[a.id] ?? 1) || a.name.localeCompare(b.name));

  async function pick(a: Agent) {
    setBusy(a.id);
    setError(null);
    try {
      onAssigned(await assignAgent(project.id, "consultant", a.id, "Consultant selected", project));
    } catch (e) {
      setError(describeDbError(e, "Choosing the consultant"));
      setBusy(null);
    }
  }

  if (describe || mine.length === 0) {
    return (
      <div className="cs-wrap">
        {mine.length > 0 && (
          <button type="button" className="wz-back cs-back" onClick={() => setDescribe(false)} aria-label={tr("Back")}>
            <IconBack size={16} />
          </button>
        )}
        <PromptPad agents={agents} onActivate={onActivate} onDraft={onDraft} />
      </div>
    );
  }

  return (
    <section className="panel pp" aria-label={tr("Choose a consultant")}>
      <div className="pp-body">
        <div className="pp-col">
          <div className="wz">
            <div className="wz-ask">
              <span className="wz-face" aria-hidden="true"><AgentMascot role="consultant" size={72} /></span>
              <p className="wz-bubble">{tr("Who should work on this project?")}</p>
            </div>
            <div className="wz-body">
              <div className="wz-options cs-list" role="list">
                {mine.slice(0, 6).map(a => {
                  const level = levels[a.id] ?? 1;
                  return (
                    <button key={a.id} type="button" role="listitem" className="wz-opt cs-opt" disabled={!!busy} onClick={() => pick(a)}>
                      <span className="cs-face" aria-hidden="true"><AgentMascot role="consultant" size={36} agentId={a.id} /></span>
                      <span className="cs-text">
                        <span className="cs-name">{a.name}</span>
                        <span className="cs-meta">{templateFor(a)?.type ?? tr("Consultant")} · {tr("Level {n} · {level} experience", { n: level, level: tr(experienceFor(level)) })}</span>
                      </span>
                      {busy === a.id ? <span className="spinner" aria-hidden="true" /> : <IconArrow size={14} />}
                    </button>
                  );
                })}
              </div>
              {error && <p className="pp-error" role="alert"><IconAlert size={13} />{error}</p>}
            </div>
            <div className="wz-foot cs-foot">
              <button type="button" className="wz-go is-quiet" onClick={() => setDescribe(true)}>
                {tr("Describe it and let me choose")}<IconArrow size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The Assistant tab of a project without an Assistant: one sentence and one
 * button, instead of the old picker.
 */
export function AssistantMissing({ project, agents, onAssigned, onAgentCreated, topExtra }: {
  project: Project;
  agents: Agent[];
  onAssigned: (p: Project) => void;
  onAgentCreated: (a: Agent) => void;
  topExtra?: React.ReactNode;
}) {
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await addAssistant(project, agents);
      r.created.forEach(onAgentCreated);
      onAssigned(r.project);
    } catch (e) {
      setError(describeDbError(e, "Adding the Assistant"));
      setBusy(false);
    }
  }
  return (
    <section className="panel cs-assist" aria-label={tr("Assistant")}>
      {topExtra && <header className="mp-head"><div className="mp-head-row">{topExtra}</div></header>}
      <div className="cs-assist-body">
        <AgentMascot role="coach" size={64} />
        <p className="pp-lead">{tr("The Assistant reads along and helps you with the people side.")}</p>
        <button type="button" className="wz-go" disabled={busy} onClick={add}>
          {busy ? <span className="spinner" aria-hidden="true" /> : tr("Add the Assistant")}
        </button>
        {error && <p className="pp-error" role="alert"><IconAlert size={13} />{error}</p>}
      </div>
    </section>
  );
}
