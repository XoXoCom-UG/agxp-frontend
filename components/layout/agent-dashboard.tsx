"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { Agent, AgentType } from "@/lib/agents";
import { levelFor, LEVEL_ORDER } from "@/lib/agent-progress";
import { MAX_PER_TYPE, groupByType, templateFor } from "@/lib/agent-types";
import { compactNumber, type AgentUsage } from "@/lib/team-stats";
import { loadAgentDocuments, type AgentDocument } from "@/lib/agent-documents";
import { methodLabel } from "@/lib/method-labels";
import { dateStr } from "@/lib/utils";
import { AgentMascot } from "@/components/layout/agent-mascot";
import { IconPlus, IconArrow, IconBack, IconMoreV, IconX, IconDoc, IconArchive, IconRestore } from "@/components/layout/agxp-icons";

/**
 * The pieces of the Agent Dashboard (app/dashboard/agents/page.tsx): the
 * numbers along the top, one section per role, and the agent cards. Styles
 * are the `.agx-*` block at the end of app/agxp-design.css.
 *
 * Second pass, 2026-10-01: the first one copied a mockup's decoration along
 * with its layout — an icon on every number, a ring on every count, two
 * badges and two icons on every card, a fake "Online", slot numbers, page
 * dots repeating the tabs, panels wrapping cards. Everything here now
 * carries information; the mascot is the one picture on a card.
 */

/** One number in the strip along the top. */
export function Stat({ label, value, hint, children }: {
  label: string; value: string; hint?: string; children?: React.ReactNode;
}) {
  return (
    <div className="agx-stat" title={hint}>
      <dt>{label}</dt>
      <dd>{value}{children}</dd>
    </div>
  );
}

/** Usage per day as a row of bars, the newest on the right. */
export function Bars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <span className="agx-bars" aria-hidden="true">
      {values.map((v, i) => (
        // A floor so a quiet day still reads as a day, not a gap.
        <i key={i} style={{ height: `${15 + (v / max) * 85}%` }} />
      ))}
    </span>
  );
}

/** The ⋮ on a card: open the agent, or let it go. */
function CardMenu({ name, archived, onOpen, onToggleArchive }: {
  name: string; archived: boolean; onOpen: () => void; onToggleArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="agx-menu" ref={wrap}>
      <button className="agx-menu-btn" aria-label={`More for ${name}`} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(o => !o)}>
        <IconMoreV size={15} />
      </button>
      {open && (
        <div className="agx-menu-pop" role="menu">
          <button role="menuitem" onClick={() => { setOpen(false); onOpen(); }}><IconArrow size={12} />Open</button>
          <button role="menuitem" onClick={() => { setOpen(false); onToggleArchive(); }}>
            {archived ? <><IconRestore size={12} />Restore</> : <><IconArchive size={12} />Archive</>}
          </button>
        </div>
      )}
    </div>
  );
}

/** What a role's deliverable is called: the Consultant writes a Transformation
 *  Concept, the Coach a Change Plan (lib/deliverables.ts). */
function docsLabel(role: AgentType): string {
  return role === "coach" ? "Change plans" : "Transformation concepts";
}
function docLabel(role: AgentType): string {
  return role === "coach" ? "Change plan" : "Transformation concept";
}

/**
 * The face for an experience level, so the mascot shows what the card says
 * (Ana, 2026-10-01): New is the bare level-1 robot, Medium the middle one,
 * High the full level-5 one.
 */
function mascotLevel(projects: number): number {
  return [1, 3, 5][LEVEL_ORDER.indexOf(levelFor(projects))];
}

/** The user's own projects, plus any the shared catalog lists for a seeded agent. */
function projectTotal(agent: Agent, usage: AgentUsage | undefined): number {
  return (usage?.projects ?? 0) + agent.last_projects.length;
}

/**
 * One agent: the face and its level, the name, and a small statistic whose
 * last number opens every Transformation Concept it wrote (sync with Patryk,
 * 2026-09-30). Half the height it first had (Ana, 2026-10-01) — what it can
 * do and its projects are in the card that opens on click.
 */
function AgentCard({ agent, usage, onOpen, onDocs, onToggleArchive }: {
  agent: Agent; usage: AgentUsage | undefined;
  onOpen: (from: HTMLElement) => void; onDocs: (from: HTMLElement) => void; onToggleArchive: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const from = () => ref.current!;
  const projects = projectTotal(agent, usage);
  const docs = usage?.docs ?? 0;
  const level = mascotLevel(projects);
  return (
    <article className={`agx-card${agent.archived_at ? " is-archived" : ""}`} ref={ref}>
      <button className="agx-card-hit" onClick={() => onOpen(from())} aria-label={`Show details for ${agent.name}`}
        data-agent={agent.id} />

      <header className="agx-card-head">
        <AgentMascot role={agent.type} size={50} level={level} />
        <div className="agx-card-text">
          <h3 className="agx-name">{agent.name}</h3>
          <p className="agx-meta">
            Level {level} · {levelFor(projects)} experience
            {templateFor(agent) ? ` · ${templateFor(agent)!.type}` : ""}
          </p>
        </div>
        <CardMenu name={agent.name} archived={!!agent.archived_at}
          onOpen={() => onOpen(from())} onToggleArchive={onToggleArchive} />
      </header>

      <div className="agx-card-stats">
        <div><span>Projects</span><b>{projects}</b></div>
        <div><span>Tokens</span><b>{compactNumber(usage?.tokens ?? 0)}</b></div>
        {/* Which industries its projects were in (Patryk: "Branche, also z.B. Bank oder Software"). */}
        <div className="agx-stat-industry" title={usage?.industries.join(", ") || undefined}>
          <span>Industry</span>
          <b>{usage?.industries.length ? usage.industries.slice(0, 2).join(", ") : "–"}</b>
        </div>
        {/* The third number is also the way to every document it wrote. */}
        <button className="agx-docs-btn" onClick={() => onDocs(from())} disabled={docs === 0}
          aria-label={`${docsLabel(agent.type)} by ${agent.name}: ${docs}`}>
          <span>{docsLabel(agent.type)}</span>
          <b>{docs}</b>
          <IconArrow size={11} />
        </button>
      </div>

    </article>
  );
}

/**
 * How an overlay arrives and leaves. It grows out of the card that opened it
 * and shrinks back into the same card (Apple: "if something disappears one
 * way, we expect it to emerge from where it came"). The motion is a clip
 * between the card's box and the role's box, driven by CSS transitions —
 * which start from the current value, so closing halfway through opening
 * simply turns around instead of jumping.
 */
type OverlayMotion = {
  phase: "open" | "closing";
  /** The source card's box, as inset() distances inside the role section. */
  inset: string;
};

function overlayProps(m: OverlayMotion, onClosed: () => void) {
  return {
    className: "agx-info",
    "data-phase": m.phase,
    style: { "--agx-from": `inset(${m.inset} round var(--radius-md))` } as React.CSSProperties,
    onTransitionEnd: (e: React.TransitionEvent) => {
      if (m.phase === "closing" && e.target === e.currentTarget && e.propertyName === "clip-path") onClosed();
    },
    inert: m.phase === "closing" ? true : undefined,
  };
}

/**
 * Marks whether there is more to scroll above or below, so the edge can fade
 * instead of being cut by a hard line (Apple's scroll-edge effect).
 */
function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      el.toggleAttribute("data-more-above", el.scrollTop > 1);
      el.toggleAttribute("data-more-below", el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  });
  return ref;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** One agent's deliverables, loaded when asked for. */
function useAgentDocs(agent: Agent): { docs: AgentDocument[] | null; failed: boolean } {
  const [docs, setDocs] = useState<AgentDocument[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadAgentDocuments(agent.id, agent.type)
      .then(d => { if (alive) { setDocs(d); setFailed(false); } })
      // "None yet" would be a false answer to a failed read.
      .catch(() => { if (alive) { setDocs([]); setFailed(true); } });
    return () => { alive = false; };
  }, [agent.id, agent.type]);
  return { docs, failed };
}

/** Escape closes, and focus moves to the close button when the card opens. */
function useOverlayKeys(onClose: () => void) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Read through a ref: the parent's handler is a new function every render,
  // and this effect must run once — it is also what moves focus in.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  return closeRef;
}

/** The list of documents, each one leading to the project it was written in. */
function DocList({ role, docs, failed }: { role: AgentType; docs: AgentDocument[] | null; failed: boolean }) {
  if (failed) return <p className="agx-info-none">These couldn&apos;t be loaded. Close and reopen to try again.</p>;
  if (docs === null) return <p className="agx-info-none">Loading…</p>;
  if (docs.length === 0) return <p className="agx-info-none">No {docsLabel(role).toLowerCase()} finished yet.</p>;
  return (
    <ul>
      {docs.map(d => (
        <li key={d.id}>
          <Link className="agx-info-row" href={`/dashboard/project/${d.projectId}`}>
            <IconDoc size={13} />
            <span className="agx-info-t">{d.title}</span>
            <span className="agx-info-p">{d.projectName}</span>
            <span className="agx-info-d">{dateStr(d.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Every Transformation Concept (or Change Plan) one agent has written. */
function AgentDocs({ agent, usage, motion, onClose, onClosed }: {
  agent: Agent; usage: AgentUsage | undefined; motion: OverlayMotion; onClose: () => void; onClosed: () => void;
}) {
  const { docs, failed } = useAgentDocs(agent);
  const closeRef = useOverlayKeys(onClose);
  const titleId = useId();
  const bodyRef = useScrollEdges<HTMLDivElement>();
  return (
    <div {...overlayProps(motion, onClosed)} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="agx-info-head">
        <AgentMascot role={agent.type} size={40} level={mascotLevel(projectTotal(agent, usage))} />
        <div className="agx-info-id">
          <h3 id={titleId}>{docsLabel(agent.type)}</h3>
          <p>{agent.name}{docs && docs.length > 0 ? ` · ${docs.length}` : ""}</p>
        </div>
        <button ref={closeRef} className="agx-info-close" onClick={onClose} aria-label="Close list">
          <IconX size={14} />
        </button>
      </header>
      <div className="agx-info-body" ref={bodyRef}>
        <DocList role={agent.type} docs={docs} failed={failed} />
      </div>
    </div>
  );
}

/**
 * Everything about one agent, in a card laid over its own role section. It
 * replaced a full page (Ana, 2026-10-01): opening an agent should not take
 * the rest of the team off the screen.
 */
function AgentInfo({ agent, usage, motion, onClose, onClosed, onToggleArchive }: {
  agent: Agent; usage: AgentUsage | undefined; motion: OverlayMotion;
  onClose: () => void; onClosed: () => void; onToggleArchive: () => void;
}) {
  const { docs, failed } = useAgentDocs(agent);
  const closeRef = useOverlayKeys(onClose);
  const bodyRef = useScrollEdges<HTMLDivElement>();
  const projects = projectTotal(agent, usage);
  const level = levelFor(projects);
  const titleId = useId();

  const methods = [...agent.primaryMethods, ...agent.secondaryMethods];
  // This user's own projects with it, then any the shared catalog lists for a seeded agent.
  const list = usage?.projectList ?? [];
  const catalog = agent.last_projects;

  return (
    <div {...overlayProps(motion, onClosed)} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="agx-info-head">
        <AgentMascot role={agent.type} size={52} level={mascotLevel(projects)} />
        <div className="agx-info-id">
          <h3 id={titleId}>{agent.name}</h3>
          <p>{templateFor(agent)?.type ?? agent.tagline ?? (agent.type === "coach" ? "Coach" : "Consultant")}</p>
        </div>
        <button ref={closeRef} className="agx-info-close" onClick={onClose} aria-label="Close details">
          <IconX size={14} />
        </button>
      </header>

      <div className="agx-info-body" ref={bodyRef}>
        {agent.description && <p className="agx-info-desc">{agent.description}</p>}

        <dl className="agx-info-stats">
          <div><dt>Projects</dt><dd>{projects}</dd></div>
          <div>
            <dt>Experience</dt>
            <dd className="agx-info-level">
              {level}
              <span className="level-bar" aria-hidden="true">
                {LEVEL_ORDER.map((l, i) => (
                  <span key={l} className={`level-seg${i <= LEVEL_ORDER.indexOf(level) ? " on" : ""}`} />
                ))}
              </span>
            </dd>
          </div>
          <div><dt>Tokens, est.</dt><dd>{compactNumber(usage?.tokens ?? 0)}</dd></div>
          <div><dt>Documents</dt><dd>{docs === null ? "–" : docs.length}</dd></div>
        </dl>

        {methods.length > 0 && (
          <section className="agx-info-block">
            <h4>Can help with</h4>
            <div className="ag-skills">
              {methods.map(m => <span key={m.id} className="ag-skill">{methodLabel(m.name)}</span>)}
            </div>
          </section>
        )}

        <section className="agx-info-block">
          <h4>{docsLabel(agent.type)}</h4>
          <DocList role={agent.type} docs={docs} failed={failed} />
        </section>

        {(list.length > 0 || catalog.length > 0) && (
          <section className="agx-info-block">
            <h4>Projects</h4>
            <ul>
              {list.map(p => (
                <li key={p.id}>
                  <Link className="agx-info-row agx-info-proj" href={`/dashboard/project/${p.id}`}>
                    <span className="agx-info-t">{p.name}</span>
                    {p.industry && <span className="agx-info-ind">{p.industry}</span>}
                    {p.doc && <span className="agx-info-tag"><IconDoc size={11} />{docLabel(agent.type)}</span>}
                    <span className="agx-info-d">{dateStr(p.date)}</span>
                    {p.summary && <span className="agx-info-s">{p.summary}</span>}
                  </Link>
                </li>
              ))}
              {catalog.map(p => (
                <li key={p.id}>
                  <Link className="agx-info-row" href={`/dashboard/project/${p.id}`}>
                    <span className="agx-info-t">{p.name}</span>
                    <span className="agx-info-d">{dateStr(p.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="agx-info-foot">
        <button className="btn btn-ghost btn-sm" onClick={onToggleArchive}>
          {agent.archived_at ? <><IconRestore size={12} />Restore agent</> : <><IconArchive size={12} />Archive agent</>}
        </button>
      </footer>
    </div>
  );
}

/** A slot nobody is in yet, greyed out ("ausgegraut", Patryk). New agents are
 *  made from the picker, in a task. */
function FreeSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <button className="agx-free" onClick={onAdd}>
      <IconPlus size={14} />Add agent
    </button>
  );
}

/** One role: its types as tabs, and the selected type's four slots in a row. */
export function RoleSection({ role, label, agents, usage, onArchive, onRestore, onAdd }: {
  role: AgentType; label: string; agents: Agent[]; usage: Record<string, AgentUsage>;
  onArchive: (a: Agent) => void; onRestore: (a: Agent) => void; onAdd: () => void;
}) {
  // Archived agents hold no slot: they get a tab of their own, last.
  const active = agents.filter(a => !a.archived_at);
  const archived = agents.filter(a => a.type === role && a.archived_at);
  const { columns, ungrouped } = groupByType(active, role);
  // Most finished work first, then most projects: the agents you rely on lead
  // each row, the newest and emptiest trail it.
  const ranked = (list: Agent[]) => [...list].sort((a, b) =>
    (usage[b.id]?.docs ?? 0) - (usage[a.id]?.docs ?? 0)
    || projectTotal(b, usage[b.id]) - projectTotal(a, usage[a.id])
    || a.name.localeCompare(b.name));
  const tabs = [
    ...columns.map(c => ({ key: c.template.type, label: c.template.type, title: c.template.sub, agents: ranked(c.agents), cap: MAX_PER_TYPE })),
    // Agents made before the types were fixed belong to no column; they get
    // a tab of their own rather than being forced into the first one.
    ...(ungrouped.length ? [{ key: "other", label: "Other", title: "Made before the types were fixed", agents: ranked(ungrouped), cap: ungrouped.length }] : []),
    ...(archived.length ? [{ key: "archived", label: "Archived", title: "Archived agents — restore one to put it back on the team", agents: ranked(archived), cap: archived.length }] : []),
  ];
  // Open on the first type that has someone in it.
  const [sel, setSel] = useState(() => Math.max(0, tabs.findIndex(t => t.agents.length > 0)));
  const tab = tabs[Math.min(sel, tabs.length - 1)];
  const free = Math.max(0, tab.cap - tab.agents.length);
  const tablistId = useId();
  const [opened, setOpened] = useState<{
    id: string; view: "info" | "docs"; inset: string; phase: OverlayMotion["phase"];
  } | null>(null);
  const openId = opened?.id ?? null;
  // Gone once the agent is deleted: the card closes by itself.
  const open = agents.find(a => a.id === openId) ?? null;
  // The scroller: it fades at whichever edge has more behind it.
  const cardsRef = useScrollEdges<HTMLDivElement>();
  const roleRef = useRef<HTMLElement>(null);
  // Which way the last tab change went, so the new cards arrive from that side.
  const [dir, setDir] = useState(0);

  function show(id: string, view: "info" | "docs", from: HTMLElement) {
    const r = roleRef.current!.getBoundingClientRect();
    const c = from.getBoundingClientRect();
    const inset = `${c.top - r.top}px ${r.right - c.right}px ${r.bottom - c.bottom}px ${c.left - r.left}px`;
    // Mounted straight at "open": CSS @starting-style starts it at the card's box.
    setOpened({ id, view, inset, phase: "open" });
  }

  const phase = opened?.phase;

  // The close normally ends on the clip's transitionend. A close in the very
  // first frame has nothing to transition, and no event would ever come.
  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => setOpened(o => o?.phase === "closing" ? null : o), 450);
    return () => clearTimeout(t);
  }, [phase]);

  function finishClose() {
    setOpened(null);
  }

  // Focus goes back to the card it was opened from as soon as the close
  // starts: the cards are live again while the overlay shrinks into them, and
  // its own close button has just gone inert. (Not in close() itself — at
  // that moment the cards are still inert and refuse focus.)
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "open" || !returnTo.current) return;
    cardsRef.current?.querySelector<HTMLElement>(`[data-agent="${returnTo.current}"]`)?.focus();
    returnTo.current = null;
  }, [phase, cardsRef]);

  function close() {
    returnTo.current = openId;
    if (prefersReducedMotion()) { finishClose(); return; }
    setOpened(o => o && { ...o, phase: "closing" });
  }

  const motion: OverlayMotion | null = opened && { phase: opened.phase, inset: opened.inset };
  // The team stays reachable while the card shrinks away: a click on another
  // agent mid-close opens that one instead of waiting.
  const blocking = !!open && opened?.phase !== "closing";

  // The tab bar: whether there is more to either side, written onto the bar
  // as attributes so the arrows show without a re-render on every scroll.
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabsBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tabsRef.current, bar = tabsBarRef.current;
    if (!el || !bar) return;
    const update = () => {
      bar.toggleAttribute("data-more-left", el.scrollLeft > 1);
      bar.toggleAttribute("data-more-right", el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [tabs.length]);
  // Keep the chosen tab in view, the arrow keys included.
  useEffect(() => {
    tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[sel]
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [sel]);

  function nudgeTabs(dir: 1 | -1) {
    const el = tabsRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  // An opened agent closes first: once archived it leaves this tab.
  function toggleArchive(a: Agent) {
    if (openId === a.id) close();
    if (a.archived_at) onRestore(a); else onArchive(a);
  }

  function pick(i: number) {
    if (i === sel) return;
    setDir(i > sel ? 1 : -1);
    setSel(i);
  }

  function onKey(e: React.KeyboardEvent) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (sel + d + tabs.length) % tabs.length;
    pick(next);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
  }

  return (
    <section className="agx-role" ref={roleRef} aria-label={label}>
      {/* No visible heading (Ana, 2026-10-01 mockup): the type bar opens the
          card. Named for assistive tech, which has no picture to go by. */}
      <h2 className="visually-hidden">{label}</h2>
      {/* The light inside the role card: soft glows in the accent colour (the
          Appearance accent recolours them), seen through the agents' glass
          rather than painted on each card (Ana, 2026-10-01). */}
      <div className="agx-role-glow" aria-hidden="true"><i /><i /></div>

      {/* Drawn as the app's navbar (Ana, 2026-10-01): the same bar, and the
          same items and hairlines — `navbar` is what scopes .nb-item and
          .nb-rule, so a change to the navbar carries over here. */}
      <div className="agx-tabs navbar" ref={tabsBarRef} inert={blocking ? true : undefined}>
        {/* Arrows only where there is more to see (Ana, 2026-10-01, after
            YouTube's chip bar): a blurred fade with a round button in it. */}
        <button type="button" className="agx-tabs-more is-left" tabIndex={-1}
          aria-label={`Scroll ${label} types left`} onClick={() => nudgeTabs(-1)}>
          <span><IconBack size={14} /></span>
        </button>
        <div className="agx-tabs-scroll" ref={tabsRef} role="tablist" aria-label={`${label} types`} onKeyDown={onKey}>
          {tabs.map((t, i) => (
            <Fragment key={t.key}>
              {i > 0 && <span className="nb-rule" aria-hidden="true" />}
              <button role="tab" id={`${tablistId}-${i}`} aria-selected={i === sel}
                aria-controls={`${tablistId}-panel`} tabIndex={i === sel ? 0 : -1} title={t.title}
                className={`nb-item${i === sel ? " active" : ""}`} onClick={() => pick(i)}>
                {t.label}
                {/* "3/4" where there is a cap; Other and Archived have none, just a count. */}
                <span className="agx-tab-n">
                  {t.key === "other" || t.key === "archived" ? t.agents.length : `${t.agents.length}/${t.cap}`}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
        <button type="button" className="agx-tabs-more is-right" tabIndex={-1}
          aria-label={`Scroll ${label} types right`} onClick={() => nudgeTabs(1)}>
          <span><IconArrow size={14} /></span>
        </button>
      </div>

      <div className="agx-cards" ref={cardsRef} role="tabpanel" inert={blocking ? true : undefined}
        id={`${tablistId}-panel`} aria-labelledby={`${tablistId}-${sel}`}>
        <div className={`agx-cards-grid${dir ? " is-sliding" : ""}`} key={tab.key}
          style={{ "--agx-dir": dir } as React.CSSProperties}>
        {tab.agents.map(a => (
          <AgentCard key={a.id} agent={a} usage={usage[a.id]}
            onOpen={from => show(a.id, "info", from)}
            onDocs={from => show(a.id, "docs", from)} onToggleArchive={() => toggleArchive(a)} />
        ))}
        {Array.from({ length: free }, (_, i) => <FreeSlot key={`free-${i}`} onAdd={onAdd} />)}
        </div>
      </div>

      {open && motion && opened?.view === "info" && (
        <AgentInfo key={open.id} agent={open} usage={usage[open.id]} motion={motion}
          onClose={close} onClosed={finishClose} onToggleArchive={() => toggleArchive(open)} />
      )}
      {open && motion && opened?.view === "docs" && (
        <AgentDocs key={open.id} agent={open} usage={usage[open.id]} motion={motion} onClose={close} onClosed={finishClose} />
      )}
    </section>
  );
}
