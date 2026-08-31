"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, AgentType } from "@/lib/agents";
import { listMessages, addMessage, touchProjectActivity, type Project, type ProjectMessage } from "@/lib/projects";
import { askAgent } from "@/lib/ask-agent";
import { cn } from "@/lib/utils";
import { ArrowUp, UserRoundCog, HeartHandshake } from "lucide-react";

const OPENING: Record<AgentType, string> = {
  consultant: "Hey, wie kann ich dir heute helfen?",
  coach: "Hey, worüber möchtest du heute sprechen?",
};
const QUICK_REPLIES: Record<AgentType, string[]> = {
  consultant: ["Ich möchte eine Unterhaltung über AI starten", "Erstelle mir ein IT Transformation Concept"],
  coach: ["Ich möchte über eine Veränderung im Team sprechen", "Ich brauche Coaching zu einem IT-Thema"],
};

export function ProjectChatPanel({ project, role, agent }: { project: Project; role: AgentType; agent: Agent }) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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

  return (
    <section className={cn(
      "flex-1 min-w-0 rounded-lg border border-border flex flex-col overflow-hidden",
      role === "coach" ? "bg-gradient-to-b from-coach-3 to-background" : "bg-gradient-to-b from-consultant-3 to-background"
    )}>
      {/* Head */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
        <div className={cn("w-[38px] h-[38px] rounded-md flex items-center justify-center shrink-0",
          role === "coach" ? "bg-coach-2" : "bg-consultant-2")}>
          {role === "coach" ? <HeartHandshake className="w-[17px] h-[17px] text-white/90" strokeWidth={1.8} /> : <UserRoundCog className="w-[17px] h-[17px] text-white/90" strokeWidth={1.8} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mt-0.5">{role === "coach" ? "Coach" : "Consultant"}</p>
        </div>
        <div className="flex gap-4 text-right shrink-0">
          <div><p className="text-[10px] text-muted-foreground">Knowledge</p><p className="text-xs font-semibold text-foreground">{agent.knowledge_level}</p></div>
          <div><p className="text-[10px] text-muted-foreground">Projects</p><p className="text-xs font-semibold text-foreground">{agent.last_projects.length}</p></div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
        {!loaded && <div className="thinking-spinner mx-auto" style={{ width: 18, height: 18 }} />}

        {loaded && (
          <AgentBubble name={agent.name} text={OPENING[role]} />
        )}
        {loaded && messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 -mt-2">
            {QUICK_REPLIES[role].map(q => (
              <button key={q} onClick={() => send(q)} className="choice-chip text-[12px]">{q}</button>
            ))}
          </div>
        )}

        {messages.map(m => m.role === "user"
          ? <UserBubble key={m.id} text={m.content} />
          : <AgentBubble key={m.id} name={agent.name} text={m.content} />)}

        {sending && (
          <div className="flex items-center gap-2">
            <span className="w-[3px] h-[13px] rounded bg-border-strong" />
            <div className="thinking-spinner" style={{ width: 14, height: 14 }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex gap-2.5 items-end px-5 py-3.5 border-t border-border shrink-0">
        <textarea value={input} rows={1} disabled={sending}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Ask your ${role === "coach" ? "Coach" : "Consultant"}...`}
          className="flex-1 bg-popover border border-input rounded-md px-3.5 py-2.5 text-xs text-foreground outline-none resize-none leading-relaxed placeholder:text-muted-foreground disabled:opacity-50"
          style={{ minHeight: 22, maxHeight: 100 }} />
        <button onClick={() => send(input)} disabled={!input.trim() || sending}
          className={cn("w-[42px] h-[42px] rounded-md flex items-center justify-center shrink-0 transition-opacity",
            input.trim() && !sending ? "opacity-100" : "opacity-35 cursor-not-allowed",
            role === "coach" ? "bg-coach-2" : "bg-consultant-2")}>
          <ArrowUp className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}

function AgentBubble({ name, text }: { name: string; text: string }) {
  return (
    <div className="max-w-[86%]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-[3px] h-[13px] rounded bg-border-strong" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{name}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed pl-[11px] whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="self-end max-w-[78%] bg-gradient-to-b from-popover to-card border border-input rounded-xl rounded-br-sm px-3.5 py-3 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
      {text}
    </div>
  );
}
