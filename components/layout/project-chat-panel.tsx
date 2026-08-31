"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, clearMessages, touchProjectActivity, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { parseMarkers } from "@/lib/message-markers";
import { md } from "@/lib/markdown";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import {
  IconCoach, IconConsultant, IconMore, IconUsers, IconSwap, IconPlus, IconSend,
} from "@/components/layout/agxp-icons";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, wie kann ich dir heute helfen?",
  coach: "Hey, worüber möchtest du heute sprechen?",
};
const QUICK_ACTIONS: Record<AgentType, { t: string; s: string }[]> = {
  consultant: [
    { t: "Ich möchte eine Unterhaltung über AI starten", s: "Freie Exploration — kein festes Ziel." },
    { t: "Erstelle mir ein IT Transformation Concept", s: "Strukturierte Ist/Ziel-Analyse mit Maßnahmen." },
  ],
  coach: [
    { t: "Ich möchte über eine Veränderung im Team sprechen", s: "Widerstände, Kommunikation, Team-Dynamik." },
    { t: "Ich brauche Coaching zu einem IT-Thema", s: "Begleitung bei der Einführung neuer Arbeitsweisen." },
  ],
};
const GENERATE_CONCEPT_PROMPT = "Bitte erstelle jetzt das vollständige Transformation Concept basierend auf unserem bisherigen Gespräch.";

export function ProjectChatPanel({ project, role, agent, onChangeAgent }: {
  project: Project; role: AgentType; agent: Agent; onChangeAgent: () => void;
}) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"change" | "reset" | "details" | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    listMessages(project.id, role).then(m => { if (alive) { setMessages(m); setLoaded(true); } }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, [project.id, role]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setInput("");
    const userMsg: ProjectMessage = { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "user", content: t, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      await addMessage(project.id, role, "user", t);
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await askAgent(agent, history);
      await addMessage(project.id, role, "assistant", reply);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: reply, created_at: new Date().toISOString() }]);
      touchProjectActivity(project.id, `${role === "coach" ? "Coach" : "Consultant"} replied`).catch(() => {});
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), project_id: project.id, column_type: role, role: "assistant", content: `Fehler: ${(e as Error).message}`, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  }

  async function resetConversation() {
    setConfirm(null);
    await clearMessages(project.id, role);
    setMessages([]);
  }

  // Progress only applies to the Consultant (Transformation Concept readiness).
  // Scan from the newest message backwards for the last reported value.
  let progress: number | null = null;
  if (role === "consultant") {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "assistant") continue;
      const p = parseMarkers(messages[i].content).progress;
      if (p !== null) { progress = p; break; }
    }
  }
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return i;
    return -1;
  })();

  return (
    <section className={`panel ${role}`}>
      {confirm === "change" && (
        <ConfirmDialog title="Change agent?" body={`You'll return to selection for the ${role === "coach" ? "Coach" : "Consultant"} only. The other agent stays assigned.`}
          confirmLabel="Change agent" onConfirm={() => { setConfirm(null); onChangeAgent(); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === "reset" && (
        <ConfirmDialog title="Start a new conversation?" body="Current chat messages will be cleared." confirmLabel="Start new"
          onConfirm={resetConversation} onCancel={() => setConfirm(null)} />
      )}
      {confirm === "details" && (
        <ConfirmDialog title={agent.name} confirmLabel="Close" onConfirm={() => setConfirm(null)} onCancel={() => setConfirm(null)}
          body={`${agent.expertise || agent.tagline || ""}. Knowledge: ${agent.knowledge_level}.${agent.primaryMethods.length ? " Primary methods: " + agent.primaryMethods.map(m => m.name).join(", ") + "." : ""}`} />
      )}

      <div className="chat-head">
        <div className="chat-avatar">{role === "coach" ? <IconCoach size={17} /> : <IconConsultant size={17} />}</div>
        <div>
          <div className="n">{agent.name}</div>
          <div className="r"><span className={`role-dot ${role}`} />{role === "coach" ? "Coach" : "Consultant"}</div>
        </div>
        <div className="chat-meta">
          <div className="cm">Knowledge<b>{agent.knowledge_level}</b></div>
          <div className="cm">Projects<b>{agent.last_projects.length}</b></div>
          {progress !== null && <div className="cm">Context<b>{progress}%</b></div>}
        </div>
        <button className="chat-menu-btn" data-tooltip="Agent menu" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}>
          <IconMore />
        </button>
        {menuOpen && (
          <div className="popover" onClick={e => e.stopPropagation()}>
            <button className="mi" onClick={() => { setMenuOpen(false); setConfirm("details"); }}><IconUsers size={13} />Agent details</button>
            <button className="mi" onClick={() => { setMenuOpen(false); setConfirm("change"); }}><IconSwap size={13} />Change agent</button>
            <button className="mi" onClick={() => { setMenuOpen(false); setConfirm("reset"); }}><IconPlus size={13} />New conversation</button>
          </div>
        )}
      </div>

      {progress !== null && (
        <div className={`progress-banner ${progress >= 100 ? "ready" : ""}`}>
          <div className="top">
            <span>Context für Transformation Concept</span>
            <b style={{ marginLeft: "auto" }}>{progress}%</b>
          </div>
          <div className="bar"><span style={{ width: `${progress}%` }} /></div>
          {progress >= 100 && (
            <button className="ready-cta" disabled={sending} onClick={() => send(GENERATE_CONCEPT_PROMPT)}>
              Transformation Concept erstellen
            </button>
          )}
        </div>
      )}

      <div className="chat-body">
        {!loaded && <div className="spinner" style={{ margin: "0 auto", borderColor: "var(--border-strong)", borderTopColor: "var(--foreground)" }} />}

        {loaded && (
          <div className="msg-agent">
            <div className="marker"><span className="bar" /><span className="who">{agent.name}</span></div>
            <div className="txt">{OPENING[role]}</div>
          </div>
        )}
        {loaded && messages.length === 0 && (
          <div className="qa-list">
            {QUICK_ACTIONS[role].map((q, i) => (
              <button key={q.t} className="qa-item" onClick={() => send(q.t)}>
                <span className="qno">0{i + 1}</span>
                <div className="qtxt"><div className="qt">{q.t}</div><div className="qs">{q.s}</div></div>
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "user") return <div key={m.id} className="msg-user">{m.content}</div>;
          const parsed = parseMarkers(m.content);
          const showChoices = i === lastAssistantIdx && parsed.choices.length > 0 && !sending;
          return (
            <div key={m.id} className="msg-agent">
              <div className="marker"><span className="bar" /><span className="who">{agent.name}</span></div>
              <div className="txt" dangerouslySetInnerHTML={{ __html: md(parsed.text) }} />
              {showChoices && (
                <div className="choice-row">
                  {parsed.choices.map(c => (
                    <button key={c} className="choice-chip" disabled={sending} onClick={() => send(c)}>{c}</button>
                  ))}
                </div>
              )}
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
          placeholder={`Ask your ${role === "coach" ? "Coach" : "Consultant"}...`} />
        <button data-tooltip="Send message" disabled={!input.trim() || sending} onClick={() => send(input)}>
          <IconSend size={14} />
        </button>
      </div>
    </section>
  );
}
