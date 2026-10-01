"use client";

import { useEffect, useId, useState } from "react";
import type { Agent, AgentType, Method } from "@/lib/agents";
import { listAllMethods, createAgent } from "@/lib/agents";
import { assignAgent, type Project } from "@/lib/projects";
import { levelFor, LEVEL_ORDER } from "@/lib/agent-progress";
import { TYPE_CATALOG, MAX_PER_TYPE, type TypeTemplate } from "@/lib/agent-types";
import { methodLabel } from "@/lib/method-labels";
import { dateStr } from "@/lib/utils";
import { describeDbError } from "@/lib/db-error";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { useMascotReplies, levelFromReplies } from "@/lib/mascot-level";
import {
  IconBack, IconArrow, IconSearch, IconCheck, IconAlert, IconRefresh, IconPlus,
} from "@/components/layout/agxp-icons";

type PanelState = "empty" | "list" | "detail" | "type" | "configure";

const ROLE_LABEL: Record<AgentType, string> = { consultant: "Consultant", coach: "Coach" };
/**
 * Ana's two ways in (agxp-frontend-ana): make one, or train one you have.
 *
 * Cut to one line each on 2026-09-30, when the empty state grew a headline.
 * The old copy explained the choice in three lines per card, and then the
 * headline said the same thing again above them — the picker round Ana chose
 * ("Billboard") keeps the headline and drops the explanation.
 */
const PICKER_HEAD: Record<AgentType, { create: string; train: string }> = {
  consultant: {
    create: "Create new AI consultant",
    train: "Train one of your AI team members",
  },
  coach: {
    create: "Create new AI coach",
    train: "Train one of your AI team members",
  },
};

export function AgentPickerPanel({ role, project, agents, ensureProject, onAssigned, onAgentCreated, projectCounts = {}, assignedAgent, onChangeAgent }: {
  role: AgentType;
  /** Null until the project row exists — it's created lazily on the first real action. */
  project: Project | null;
  agents: Agent[];
  ensureProject: () => Promise<Project>;
  onAssigned: (project: Project) => void;
  onAgentCreated: (agent: Agent) => void;
  /** Projects each agent has worked on for this user — drives its level. */
  projectCounts?: Record<string, number>;
  /** Already chosen, but the chat has not started yet: show who it is. */
  assignedAgent?: Agent | null;
  onChangeAgent?: () => void;
}) {
  const totalProjects = (a: Agent) => a.last_projects.length + (projectCounts[a.id] ?? 0);
  const [state, setState] = useState<PanelState>("empty");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TypeTemplate | null>(null);
  /** Picking failed — which agent, so Retry can pick it again. */
  const [selectError, setSelectError] = useState<{ agentId: string; message: string } | null>(null);
  const replies = useMascotReplies();
  const searchId = useId();
  const lockedHintId = useId();

  // Archived agents keep their place on old projects but are not offered here.
  const roleAgents = agents.filter(a => a.type === role && !a.archived_at);
  const filtered = roleAgents.filter(a => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const hay = [a.name, a.tagline ?? "", a.expertise ?? "", ...a.methods.map(m => m.name)].join(" ").toLowerCase();
    return hay.includes(q);
  });

  /** Picking is the action — no "are you sure?" in between. If it was the
   *  wrong one you simply pick again (Patryk, 2026-09-11). */
  async function select(agentId: string) {
    setBusy(true);
    setSelectError(null);
    try {
      const p = project ?? await ensureProject();
      onAssigned(await assignAgent(p.id, role, agentId, `${ROLE_LABEL[role]} selected`));
    } catch (e) {
      // Without this the button just stops spinning and nothing happens —
      // indistinguishable from a click that didn't register.
      setSelectError({ agentId, message: describeDbError(e, `Choosing the ${ROLE_LABEL[role].toLowerCase()}`) });
    } finally { setBusy(false); }
  }

  const showBack = state !== "empty";
  // Ana's rule: the Coach can only be picked once a Consultant exists. It
  // answers "when does the Coach appear" without a timer or a popup.
  const locked = role === "coach" && !project?.consultant_agent_id;
  // The "train existing" head wears whichever agent this user has grown the
  // furthest in this role, so the two cards differ at a glance. No agents
  // yet — plain head, nothing to brag about.
  const trainedLevel = levelFromReplies(
    roleAgents.reduce((most, a) => Math.max(most, replies[a.id] ?? 0), 0),
  );

  // Chosen, waiting for Start. Showing who it is beats an empty panel, and
  // this is the one place changing your mind is free.
  if (assignedAgent) {
    const total = totalProjects(assignedAgent);
    return (
      <section className={`panel ${role}`}>
        {/* A hairline under the mascot (mockup, 2026-09-28): it gives the
            waiting panel the same head/body split the running one has, so
            pressing Start doesn't redraw the shape of the panel. */}
        <div className="panel-head sel-head">
          <AgentMascot role={role} size={68} enter agentId={assignedAgent.id} />
        </div>
        <div className="selected-summary">
          <div className="sel-name">{assignedAgent.name}</div>
          {assignedAgent.tagline && <div className="sel-type">{assignedAgent.tagline}</div>}
          <div className="sel-type">{levelFor(total)} · {total} {total === 1 ? "project" : "projects"} together</div>
          {assignedAgent.primaryMethods.length > 0 && (
            <div className="sel-methods">{assignedAgent.primaryMethods.map(m => methodLabel(m.name)).join(" · ")}</div>
          )}
          {onChangeAgent && <button className="btn btn-hero" onClick={onChangeAgent}>Change agent</button>}
        </div>
      </section>
    );
  }

  return (
    <section className={`panel ${role}`}>
      {/* No "Your consultant" headline any more (Ana, 2026-10-01): the two
          cards say what the seat is for. What is left of the head is the way
          back, in the steps that have one. */}
      {showBack && (
        <div className="panel-head panel-head-back">
          <button className="back-link" onClick={() => setState(state === "detail" ? "list" : state === "configure" ? "type" : "empty")}>
            <IconBack size={11} /> Back
          </button>
        </div>
      )}

      {selectError && (
        <div className="inline-error" role="alert">
          <IconAlert size={14} />
          <p className="ie-detail">{selectError.message}</p>
          <button className="btn btn-ghost" disabled={busy} onClick={() => select(selectError.agentId)}>
            <IconRefresh size={12} />Retry
          </button>
        </div>
      )}

      {state === "empty" && locked ? (
        // "…oder dieses ganze Fenster auch gar nicht haben, sondern es
        // erscheint erst nachdem man Start geklickt hat." Greying the two
        // cards out was the other option; an empty seat that simply says when
        // it opens is quieter than two dimmed buttons nobody may press.
        <div className="pick-empty pick-waiting">
          <AgentMascot role={role} size={64} />
          <p className="pw-title">Your coach joins next</p>
          <p className="pw-sub" id={lockedHintId}>Pick a Consultant first. This seat opens once there is one.</p>
        </div>
      ) : state === "empty" ? (
        // Patryk, 2026-09-30: the card said "Create new AI Consultant", then
        // explained it in three lines, then said "Create new agent" again
        // underneath — the same sentence twice, in two different words.
        // "Also das reicht ja, oder? Es reicht." So a heading and a button,
        // and nothing between them.
        <div className="pick-empty">
          <div className="pick-cards">
            {/* The whole card is the control, not just the strip at the
                bottom — a card that lifts under the cursor but only counts a
                click on its last 50px is a trap. So the CTA is a span and the
                card itself is the button. */}
            {/* Two big cards, a picture and one line each (Ana, 2026-10-01:
                "super puțin text"). The picture is who you would get: a
                brand-new level-1 robot, or the furthest-grown one you have.
                The whole card is the button; its line is its label. */}
            <button className="picker-card pc-create" onClick={() => setState("type")}>
              <span className="pc-face" aria-hidden="true">
                {/* The badge rides with the robot when it lifts, and turns on hover. */}
                <span className="pc-lift">
                  <AgentMascot role={role} size={104} level={1} />
                  <span className="pc-badge"><IconPlus size={16} /></span>
                </span>
              </span>
              <span className="picker-card-title">{PICKER_HEAD[role].create}</span>
            </button>

            <button className="picker-card pc-train" onClick={() => setState("list")}>
              <span className="pc-face" aria-hidden="true">
                <span className="pc-lift"><AgentMascot role={role} size={104} level={trainedLevel} /></span>
              </span>
              <span className="picker-card-title">{PICKER_HEAD[role].train}</span>
            </button>
          </div>
        </div>

      ) : state === "list" ? (
        <>
          <div className="list-toolbar">
            <div className="search-box"><IconSearch size={13} />
              <label htmlFor={searchId} className="visually-hidden">Search your {ROLE_LABEL[role].toLowerCase()}s</label>
              <input id={searchId} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or what they do…" />
            </div>
          </div>
          <div className="list-section-label">People you have worked with</div>
          {filtered.length === 0 ? (
            <div className="empty-search">
              <div className="t">No agents found</div>
              <div className="d">Try another name, or make a new one.</div>
              <button className="btn btn-ghost" onClick={() => setSearch("")}>Clear search</button>
            </div>
          ) : (
            <div className="directory">
              {/* A real button, so Enter and Space work without a handler.
                  Its content is phrasing only (spans), which is all a button
                  may hold; the name comes from the text, read in order. */}
              {filtered.map(a => {
                const total = totalProjects(a);
                return (
                  <button key={a.id} type="button" className="dir-row"
                    onClick={() => { setDetailId(a.id); setState("detail"); }}>
                    <span className="dr-name">{a.name}</span>
                    {a.tagline && <span className="dr-sub">{a.tagline}</span>}
                    {a.primaryMethods.length > 0 && <span className="dr-methods"><span className="mlabel">Primary</span>{a.primaryMethods.map(m => methodLabel(m.name)).join(" · ")}</span>}
                    {a.secondaryMethods.length > 0 && <span className="dr-methods secondary"><span className="mlabel">Secondary</span>{a.secondaryMethods.map(m => methodLabel(m.name)).join(" · ")}</span>}
                    <span className="dr-foot">
                      <span className="proj-count">{levelFor(total)} · {total} {total === 1 ? "project" : "projects"}</span>
                      <span className="dr-select" aria-hidden="true">Select <IconArrow /></span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>

      ) : state === "detail" ? (
        <DetailView agent={roleAgents.find(a => a.id === detailId) ?? null} role={role} busy={busy}
          totalProjects={totalProjects} onSelect={a => select(a.id)} />

      ) : state === "type" ? (
        <>
          <div className="step-eyebrow">Step 1 of 2: what kind of help?</div>
          <div className="type-wrap">
            {TYPE_CATALOG[role].map(t => {
              // Four per type is the cap (Patryk, 2026-09-30). Past it the
              // answer is not a failed insert — it is "delete one first",
              // said before the click.
              const used = roleAgents.filter(a => a.tagline === t.sub).length;
              const full = used >= MAX_PER_TYPE;
              return (
              <div key={t.type} className={`type-card${full ? " is-full" : ""}`}>
                <div className="type-card-top">
                  <div>
                    <h3>{t.type}</h3>
                    <div className="desc">{t.description}</div>
                  </div>
                  <div className="tc-right">
                    <span className="tc-count">{used} of {MAX_PER_TYPE}</span>
                    {full ? (
                      <span className="tc-full">Full — delete one first</span>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => { setDraft(t); setState("configure"); }}>Select <IconArrow /></button>
                    )}
                  </div>
                </div>
                <div className="detail-section flush">
                  <span className="lbl">Can help with</span>
                  <ul className="plist">
                    {[...t.primary, ...t.secondary].map(m => <li key={m}>{methodLabel(m)}</li>)}
                  </ul>
                </div>
              </div>
              );
            })}
          </div>
        </>

      ) : (
        <ConfigureView role={role} template={draft} onCreated={agent => { onAgentCreated(agent); select(agent.id); }} />
      )}
    </section>
  );
}

function DetailView({ agent, role, busy, totalProjects, onSelect }: {
  agent: Agent | null; role: AgentType; busy: boolean;
  totalProjects: (a: Agent) => number;
  onSelect: (agent: Agent) => void;
}) {
  if (!agent) return null;
  const total = totalProjects(agent);
  const level = levelFor(total);
  return (
    <div className="detail">
      <div className="role-line"><span className={`role-dot ${role}`} /><span className="role-eyebrow">{ROLE_LABEL[role]}</span></div>
      <h2>{agent.name}</h2>
      {agent.description && <div className="detail-desc">{agent.description}</div>}
      <div className="sb-stats">
        <div>
          <span className="lbl">Experience</span>
          <div className="level">
            <b>{level}</b>
            <span className="level-bar">
              {LEVEL_ORDER.map((l, i) => <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />)}
            </span>
          </div>
        </div>
        <div><span className="lbl">Projects together</span><b>{total}</b></div>
        {agent.tagline && <div><span className="lbl">Role</span><b>{agent.tagline}</b></div>}
      </div>
      {agent.methods.length > 0 && (
        <div className="detail-section">
          <span className="lbl">Can help with</span>
          <ul className="plist">
            {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
              <li key={m.id}>{methodLabel(m.name)}</li>
            ))}
          </ul>
        </div>
      )}
      {agent.last_projects.length > 0 && (
        <div className="detail-section"><span className="lbl">Recent projects</span>
          <div className="timeline">{agent.last_projects.map(p => (
            <div key={p.id} className="t-item"><div className="pn">{p.name}</div><div className="pd">{dateStr(p.created_at)}</div></div>
          ))}</div>
        </div>
      )}
      <button className="detail-select-btn" disabled={busy} onClick={() => onSelect(agent)}>
        Select {ROLE_LABEL[role]} <IconArrow />
      </button>
    </div>
  );
}

function ConfigureView({ role, template, onCreated }: { role: AgentType; template: TypeTemplate | null; onCreated: (a: Agent) => void }) {
  const t = template ?? TYPE_CATALOG[role][0];
  const [name, setName] = useState(t.type);
  const [description, setDescription] = useState(t.description);
  const [allMethods, setAllMethods] = useState<Method[] | null>(null);
  /** The method list failed to load. Without it Create can never be valid,
   *  so this has to be on screen instead of a button that just stays grey. */
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [methodsAttempt, setMethodsAttempt] = useState(0);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const descId = useId();
  const helpsId = useId();
  const reasonId = useId();

  useEffect(() => {
    let alive = true;
    listAllMethods()
      .then(m => { if (alive) setAllMethods(m); })
      .catch(e => { if (alive) setMethodsError(describeDbError(e, "Loading the methods")); });
    return () => { alive = false; };
  }, [methodsAttempt]);

  function retryMethods() {
    setMethodsError(null);
    setAllMethods(null);
    setMethodsAttempt(n => n + 1);
  }

  // The type decides the methods — the user names the agent, not its skillset.
  const methodIds = (allMethods ?? []).filter(m => t.primary.includes(m.name) || t.secondary.includes(m.name)).map(m => m.id);
  const valid = name.trim().length > 0 && methodIds.length > 0;
  /** Why Create won't go yet, in words — shown beside the button, not only
   *  in a tooltip. The load error has its own box with a Retry. */
  const blockReason = saving || methodsError ? null
    : allMethods === null ? "Loading what this agent can help with…"
    : methodIds.length === 0 ? "None of this type's methods are in the database yet, so it can't be created."
    : !name.trim() ? "Give the agent a name first."
    : null;

  async function submit() {
    setTouched(true);
    setError(null);
    if (!valid || saving) return;
    setSaving(true);
    try {
      const agent = await createAgent({ type: role, name: name.trim(), description: description.trim(), tagline: t.sub, methodIds });
      onCreated(agent);
    } catch (e) {
      // The Postgres error code goes on screen — the bare RLS message alone
      // never said which policy was missing.
      setError(describeDbError(e, "Creating the agent"));
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="step-eyebrow">Step 2 of 2: give them a name</div>
      <div className="configure">
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input id={nameId} type="text" value={name} onChange={e => setName(e.target.value)}
            aria-invalid={touched && !name.trim() ? true : undefined} />
          {touched && !name.trim() && <div className="field-err">Agent name is required.</div>}
        </div>
        <div className="field">
          <label htmlFor={descId}>Description</label>
          <textarea id={descId} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        {/* Not form controls, so not <label>s: a label with nothing to label
            is announced as a stray label. The list is named by its heading. */}
        <div className="field">
          <span className="field-label" id={helpsId}>Can help with</span>
          <ul className="plist" aria-labelledby={helpsId}>{[...t.primary, ...t.secondary].map(m => <li key={m}>{methodLabel(m)}</li>)}</ul>
        </div>
        <div className="field">
          <span className="field-label">Experience</span>
          <div className="field-val">New. You two have not worked together yet.</div>
        </div>
        {methodsError && (
          <div className="inline-error" role="alert">
            <IconAlert size={14} />
            <p className="ie-detail">{methodsError}</p>
            <button className="btn btn-ghost" onClick={retryMethods}><IconRefresh size={12} />Retry</button>
          </div>
        )}
        {error && <div className="field-err" role="alert">{error}</div>}
        <div className="configure-actions">
          {/* aria-disabled rather than disabled: it stays focusable, and the
              reason below is tied to it, so nobody meets a silent grey button. */}
          <button className="btn btn-solid" aria-disabled={!valid || saving || undefined}
            aria-describedby={blockReason ? reasonId : undefined}
            data-tooltip={blockReason ?? undefined}
            onClick={submit}>
            {saving
              ? <><span className="spinner" aria-hidden="true" /><span className="visually-hidden">Creating…</span></>
              : (<><IconCheck size={13} />Create</>)}
          </button>
        </div>
        {blockReason && <p className="create-hint" id={reasonId}>{blockReason}</p>}
      </div>
    </>
  );
}
