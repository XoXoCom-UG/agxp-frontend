"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, renameFromFirstMessage, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers, looksLikeDocument, type TopicMarker, type MemoryNote } from "@/lib/message-markers";
import { loadAgentMemory, memoryLines, EMPTY_MEMORY, type AgentMemory } from "@/lib/agent-memory";
import { DELIVERABLES } from "@/lib/deliverables";
import { methodLabel, methodBlurb } from "@/lib/method-labels";
import { levelFor, nextLevel, LEVEL_ORDER } from "@/lib/agent-progress";
import { md } from "@/lib/markdown";
import { AgentMascot, type MascotState } from "@/components/layout/agent-mascot";
import type { DeliverableDoc } from "@/components/layout/deliverable-view";
import { IconArrow, IconSend, IconCheck, IconSearch, IconDoc, IconSpark, IconRefresh } from "@/components/layout/agxp-icons";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, what can I do for you today?",
  coach: "Hey, what would you like to talk through today?",
};

/** Each role's way in: the Consultant interviews, the Coach takes the temperature. */
const OPENER_ACTION: Record<AgentType, { title: string; prompt: string }> = {
  consultant: {
    title: "Take me through it step by step",
    prompt: "Let's do a full assessment with the standardized interview process.",
  },
  coach: {
    title: "See how the team is doing",
    prompt: "Let's check how ready the team is for this change.",
  },
};

/** The agent offers what it knows: the guided interview, or one of its methods. */
function quickActions(agent: Agent) {
  const deliverable = DELIVERABLES[agent.type];
  const actions = [{
    ...OPENER_ACTION[agent.type],
    blurb: `${deliverable.stations.length} short questions, then you get your ${deliverable.title}.`,
    icon: <IconCheck size={14} />,
  }];
  for (const m of agent.primaryMethods.slice(0, 3)) {
    actions.push({
      title: methodLabel(m.name),
      blurb: methodBlurb(m.name),
      prompt: `Let's work through the ${methodLabel(m.name)} method together.`,
      icon: <IconSearch size={14} />,
    });
  }
  return actions;
}

export function ProjectChatPanel({ project, role, agent, primary, projectCount = 0, onProjectNamed, onActivity, onOpenDoc }: {
  project: Project; role: AgentType; agent: Agent;
  /** Consultant leads the layout (larger). */
  primary?: boolean;
  /** How many of the user's projects this agent has worked on, this one included. */
  projectCount?: number;
  onProjectNamed?: (name: string) => void;
  /** Fires when a reply lands — the screen marks the tab on stacked layouts,
   *  where only one panel is on screen at a time. */
  onActivity?: () => void;
  /** Opens the finished deliverable in the full document view (owned by the screen). */
  onOpenDoc?: (doc: DeliverableDoc) => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [orb, setOrb] = useState<MascotState>("idle");
  // What the agent brings from this user's earlier projects, plus what it
  // picked up during this session.
  const [memory, setMemory] = useState<AgentMemory>(EMPTY_MEMORY);
  const [learned, setLearned] = useState<MemoryNote[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deliverable = DELIVERABLES[role];

  useEffect(() => () => { if (speakTimer.current) clearTimeout(speakTimer.current); }, []);

  function playSpeaking() {
    setOrb("speaking");
    if (speakTimer.current) clearTimeout(speakTimer.current);
    speakTimer.current = setTimeout(() => setOrb("idle"), 900);
  }

  useEffect(() => {
    let alive = true;
    listMessages(project.id, role).then(m => { if (alive) { setMessages(m); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [project.id, role]);

  // Memory is read from the user's other projects with this agent, so the
  // current one is excluded — an agent should not "remember" today's answers.
  useEffect(() => {
    let alive = true;
    loadAgentMemory(agent.id, role, project.id)
      .then(m => { if (alive) setMemory(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [agent.id, role, project.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  function buildDoc(content: string, title: string, createdAt: string, version: number): DeliverableDoc {
    return { title, role, agentName: agent.name, projectName: project.name, content, createdAt, version };
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setInput("");
    const isFirstEver = messages.length === 0;
    const userMsg: ProjectMessage = { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "user", content: t, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    setOrb("thinking");
    try {
      await addMessage(project.id, role, "user", t);
      if (isFirstEver) {
        renameFromFirstMessage(project, t).then(name => { if (name) onProjectNamed?.(name); }).catch(() => {});
      }
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent(agent, history, memoryLines(memory, learned));
      await addMessage(project.id, role, "assistant", reply);
      const createdAt = new Date().toISOString();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: reply, created_at: createdAt }]);
      playSpeaking();
      onActivity?.();
      // The document is the moment worth showing — open it right away instead
      // of leaving the user to find a card in the scrollback.
      const parsed = parseMarkers(reply);
      // Anything the agent decided to remember shows up in the Steckbrief
      // right away, and travels with it into the next project.
      if (parsed.memories.length) setLearned(prev => [...prev, ...parsed.memories]);
      if (parsed.doc || looksLikeDocument(parsed.text, deliverable.title)) {
        onOpenDoc?.(buildDoc(parsed.text, parsed.doc || deliverable.title, createdAt, docs.length + 1));
      }
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: `Error: ${(e as Error).message}`, created_at: new Date().toISOString() }]);
      setOrb("idle");
    } finally {
      setSending(false);
    }
  }

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();
  const actions = quickActions(agent);

  // How far the interview has got: the newest assistant message that carries
  // each marker wins, so reloading history rebuilds the same rail.
  const { pct, station } = useMemo(() => {
    let pct: number | null = null;
    let station: TopicMarker | null = null;
    for (let i = messages.length - 1; i >= 0 && (pct === null || station === null); i--) {
      if (messages[i].role !== "assistant") continue;
      const p = parseMarkers(messages[i].content);
      if (pct === null && p.progress !== null) pct = p.progress;
      if (station === null && p.topic) station = p.topic;
    }
    return { pct: pct ?? 0, station };
  }, [messages]);

  // Every version of the deliverable the agent has produced, oldest first —
  // each regeneration is a full rebuild, so they are numbered versions.
  const docs = useMemo(() =>
    messages
      .filter(m => m.role === "assistant")
      .map(m => ({ m, p: parseMarkers(m.content) }))
      .filter(({ p }) => !!p.doc || looksLikeDocument(p.text, deliverable.title)),
    [messages, deliverable.title]);

  const versionOf = new Map(docs.map((d, i) => [d.m.id, i + 1]));
  const docMsg = docs.length ? docs[docs.length - 1] : null;
  const currentDoc = docMsg
    ? buildDoc(docMsg.p.text, docMsg.p.doc || deliverable.title, docMsg.m.created_at, docs.length)
    : null;

  // What to show in the Steckbrief: this session's lessons first (they are the
  // new thing), then the older ones, deduplicated by fact.
  const shownLessons = (() => {
    const seen = new Set<string>();
    const out: { kind: string; fact: string; fresh: boolean; project?: string }[] = [];
    for (const l of [...learned].reverse()) {
      const key = l.fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: l.kind, fact: l.fact, fresh: true });
    }
    for (const l of memory.lessons) {
      const key = l.fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: l.kind, fact: l.fact, fresh: false, project: l.project });
    }
    return out;
  })();

  const stationIdx = station ? station.index - 1 : (messages.length > 0 ? 0 : -1);
  const stationLabel = station?.label || deliverable.stations[Math.max(0, stationIdx)]?.label || "";
  const ready = pct >= 100;

  // The agent levels up on the work it has actually done for this user; this
  // project is one of them, so compare against the count without it to know
  // whether joining here is what pushed it up a level.
  const totalProjects = agent.last_projects.length + projectCount;
  const level = levelFor(totalProjects);
  const leveledUp = levelFor(Math.max(0, totalProjects - 1)) !== level;
  const { next, remaining } = nextLevel(totalProjects);

  return (
    <section className={`panel ${role}${primary ? " primary" : ""}`}>
      {/* Head + Steckbrief: who this agent is, condensed */}
      <div className="chat-head">
        <AgentMascot role={role} state={orb} size={46} enter />
        <div style={{ minWidth: 0 }}>
          <div className="n">{agent.name}</div>
          <div className="r"><span className={`role-dot ${role}`} />{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
      </div>

      <div className="steckbrief">
        <div className="sb-stats">
          <div>
            <span className="lbl">Experience</span>
            <div className="level">
              <b>{level}</b>
              <span className="level-bar">
                {LEVEL_ORDER.map((l, i) => (
                  <span key={l} className={`level-seg ${i <= LEVEL_ORDER.indexOf(level) ? "on" : ""}`} />
                ))}
              </span>
              {leveledUp && <span className="level-up">Level up!</span>}
            </div>
            {next && <div className="level-hint">{remaining} more project{remaining === 1 ? "" : "s"} to {next}</div>}
          </div>
          <div><span className="lbl">Projects together</span><b>{totalProjects}</b></div>
          {agent.tagline && <div><span className="lbl">Role</span><b>{agent.tagline}</b></div>}
        </div>
        {/* Lists, not chips: Patryk's review (2026-09-10) asked for the pills
            to go everywhere in favour of plain lists. */}
        <div className="sb-lists">
          {shownLessons.length > 0 && (
            <div className="grp">
              <span className="lbl">
                Remembers about you
                {learned.length > 0 && <em className="mem-new">+{learned.length} new</em>}
              </span>
              <ul className="plist mem">
                {shownLessons.slice(0, 3).map(l => (
                  <li key={l.fact} className={l.fresh ? "fresh" : undefined}>{l.fact}</li>
                ))}
                {shownLessons.length > 3 && <li className="muted">and {shownLessons.length - 3} more</li>}
              </ul>
            </div>
          )}
          {agent.primaryMethods.length > 0 && (
            <div className="grp">
              <span className="lbl">Can help with</span>
              <ul className="plist">
                {[...agent.primaryMethods, ...agent.secondaryMethods].map(m => (
                  <li key={m.id}>{methodLabel(m.name)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* The deliverable rail: what this panel is building, and how far along it is */}
      <div className={`deliv-rail${ready ? " ready" : ""}${currentDoc ? " done" : ""}`}
        style={{ ["--dr-steps" as string]: deliverable.stations.length }}>
        <div className="dr-top">
          <span className="dr-kind"><IconDoc size={12} />{deliverable.title}</span>
          {currentDoc ? <span className="dr-done">ready</span> : <span className="dr-pct">{pct}%</span>}
        </div>
        <div className="dr-bar"><span style={{ width: `${currentDoc ? 100 : pct}%` }} /></div>
        <div className="dr-bottom">
          <span className="dr-step">
            {currentDoc
              ? docs.length > 1 ? `Version ${docs.length} generated` : "Document generated"
              : stationIdx < 0
                ? `${deliverable.stations.length} steps · not started`
                : `Step ${stationIdx + 1} of ${deliverable.stations.length} · ${stationLabel}`}
          </span>
          {currentDoc ? (
            <>
              <button className="dr-cta" onClick={() => onOpenDoc?.(currentDoc)}>
                <IconDoc size={12} />Open
              </button>
              <button className="dr-redo" disabled={sending} aria-label="Rebuild the document"
                data-tooltip="Rebuild — fuller than the last version"
                onClick={() => send(deliverable.regeneratePrompt)}>
                <IconRefresh size={13} />
              </button>
            </>
          ) : (
            <button className="dr-cta" disabled={sending} onClick={() => send(deliverable.generatePrompt)}
              data-tooltip={ready ? "Everything answered — build it" : "Builds it with what the agent knows so far"}>
              <IconSpark size={12} />Generate
            </button>
          )}
        </div>
      </div>

      <div className="chat-body">
        {!loaded && <div className="spinner" style={{ margin: "0 auto", borderColor: "var(--border-strong)", borderTopColor: "var(--foreground)" }} />}

        {loaded && (
          <div className="msg-agent">
            <div className="txt">{OPENING[role]}</div>
          </div>
        )}
        {loaded && messages.length === 0 && (
          <>
            <div className="qa-list">
              {actions.map(a => (
                <button key={a.title} className="qa-item" onClick={() => send(a.prompt)}>
                  <span className="qa-ic">{a.icon}</span>
                  <div className="qtxt"><div className="qt">{a.title}</div><div className="qs">{a.blurb}</div></div>
                  <IconArrow />
                </button>
              ))}
            </div>
            {/* What the conversation will cover, so the first click isn't blind */}
            <div className="agenda-peek">
              <span className="lbl">What we will talk about</span>
              <ol className="plist numbered">
                {deliverable.stations.map(s => <li key={s.label}>{s.label}</li>)}
              </ol>
            </div>
          </>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") return <div key={m.id} className="msg-user">{m.content}</div>;
          const parsed = parseMarkers(m.content);
          const showChoices = i === lastAssistantIdx && parsed.choices.length > 0 && !sending;
          const isDoc = !!parsed.doc || looksLikeDocument(parsed.text, deliverable.title);
          const choices = showChoices ? (
            <div className="sugg-list">
              {parsed.choices.map(c => (
                <button key={c} className="sugg-item" disabled={sending} onClick={() => send(c)}>
                  <span className="s">{c}</span>
                  <IconArrow />
                </button>
              ))}
            </div>
          ) : null;

          // A generated document is a document, not a 2000-word chat bubble.
          if (isDoc) {
            const title = parsed.doc || deliverable.title;
            const version = versionOf.get(m.id) ?? 1;
            const sections = (parsed.text.match(/^##\s+\S/gm) ?? []).length;
            const words = parsed.text.split(/\s+/).filter(Boolean).length;
            return (
              <div key={m.id} className="msg-agent">
                <button className="doc-card" onClick={() => onOpenDoc?.(buildDoc(parsed.text, title, m.created_at, version))}>
                  <span className="dc-ic"><IconDoc size={17} /></span>
                  <span className="dc-txt">
                    <span className="dc-t">{title}</span>
                    <span className="dc-s">
                      {version > 1 && `Version ${version} · `}{sections} sections · {words.toLocaleString()} words · open to read
                    </span>
                  </span>
                  <IconArrow />
                </button>
                {choices}
              </div>
            );
          }

          return (
            <div key={m.id} className="msg-agent">
              <div className="txt" dangerouslySetInnerHTML={{ __html: md(parsed.text) }} />
              {choices}
            </div>
          );
        })}

        {sending && (
          <div className="msg-typing"><span className="tline" />{agent.name} is thinking...</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input">
        <textarea className="autosize" rows={1} disabled={sending} value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Ask your ${role === "coach" ? "coach" : "consultant"}...`} />
        <button data-tooltip="Send message" disabled={!input.trim() || sending} onClick={() => send(input)}>
          <IconSend size={14} />
        </button>
      </div>
    </section>
  );
}
