"use client";

import { IconCheck, IconClock, IconFolder } from "@/components/layout/agxp-icons";
import type { Project } from "@/lib/projects";
import type { Agent } from "@/lib/agents";

/**
 * The right-hand rail on Project History: how many projects there are, a
 * filter by state, and a filter by which Consultant worked on them.
 *
 * Every number is counted from the projects already loaded for the list —
 * nothing here makes a second request, and nothing shows a count the list
 * cannot produce. The filters drive the same list, so a count and what you
 * see after clicking it can never disagree.
 */

export type StateFilter = "all" | Project["status"];

/*
 * The real statuses, not the mockup's. There is no "On hold" in the data
 * (lib/projects.ts: Not Started | In Progress | Completed | Archived), and a
 * filter that can only ever return nothing is worse than one that is absent.
 * Archived rows never reach this rail — the list drops them first.
 */
const STATES: { id: StateFilter; label: string }[] = [
  { id: "all", label: "All projects" },
  { id: "Not Started", label: "Not started" },
  { id: "In Progress", label: "In progress" },
  { id: "Completed", label: "Completed" },
];

export function HistoryRail({
  projects, agents, state, onState, consultants, onToggleConsultant,
}: {
  /** Already filtered of archived rows, same set the list counts. */
  projects: Project[];
  agents: Agent[];
  state: StateFilter;
  onState: (s: StateFilter) => void;
  /** Ids of the consultants currently ticked; empty means no restriction. */
  consultants: string[];
  onToggleConsultant: (id: string) => void;
}) {
  const count = (s: StateFilter) =>
    s === "all" ? projects.length : projects.filter(p => p.status === s).length;

  // Only consultants that actually appear, so the list is never a catalogue
  // of agents nobody used.
  const used = agents
    .filter(a => a.type === "consultant")
    .map(a => ({ agent: a, n: projects.filter(p => p.consultant_agent_id === a.id).length }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <aside className="hr" aria-label="Overview and filters">
      <div className="hr-card">
        <h2>Overview</h2>
        <ul className="hr-stats">
          <li><IconFolder size={14} /><b>{projects.length}</b><span>Total projects</span></li>
          <li><IconClock size={14} /><b>{count("In Progress")}</b><span>In progress</span></li>
          <li className="ok"><IconCheck size={14} /><b>{count("Completed")}</b><span>Completed</span></li>
          <li><IconClock size={14} /><b>{count("Not Started")}</b><span>Not started</span></li>
        </ul>
      </div>

      <div className="hr-card">
        <h2>Quick filters</h2>
        <ul className="hr-filters">
          {STATES.map(s => (
            <li key={s.id}>
              <button className={state === s.id ? "on" : undefined}
                aria-pressed={state === s.id} onClick={() => onState(s.id)}>
                <span className={`hr-dot ${String(s.id).toLowerCase().replace(/\s+/g, "-")}`} aria-hidden="true" />
                {s.label}
                <em>{count(s.id)}</em>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {used.length > 0 && (
        <div className="hr-card">
          <h2>Consultant type</h2>
          <ul className="hr-facets">
            {used.map(({ agent, n }) => {
              const on = consultants.includes(agent.id);
              return (
                <li key={agent.id}>
                  <label>
                    <input type="checkbox" checked={on}
                      onChange={() => onToggleConsultant(agent.id)} />
                    <span className="hr-tick" aria-hidden="true"><IconCheck size={10} /></span>
                    <span className="hr-facet-name">{agent.name}</span>
                    <em>{n}</em>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
