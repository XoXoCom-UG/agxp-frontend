"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getAgent, type Agent, type AgentType } from "@/lib/agents";
import { useAgentWorkspace, type WorkspaceMessage } from "@/lib/agent-workspace-store";
import { AgentNav } from "@/components/layout/agent-nav";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowUp, Download } from "lucide-react";

const OPENING: Record<AgentType, { text: string; quickReplies: string[] }> = {
  consultant: {
    text: "Hey, wie kann ich dir heute helfen?",
    quickReplies: [
      "Ich möchte eine Unterhaltung über AI starten",
      "Erstelle mir ein IT Transformation Concept",
    ],
  },
  coach: {
    text: "Hey, worüber möchtest du heute sprechen?",
    quickReplies: [
      "Ich möchte über eine Veränderung im Team sprechen",
      "Ich brauche Coaching zu einem IT-Thema",
    ],
  },
};

async function askClaude(agent: Agent, messages: WorkspaceMessage[]): Promise<string> {
  const res = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentType: agent.type, agentName: agent.name, messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen.");
  return data.content as string;
}

export default function AgentChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const column = agent?.type ?? "consultant";
  const messages = useAgentWorkspace(s => s[column].messages);
  const setColumnAgent = useAgentWorkspace(s => s.setColumnAgent);
  const addMessage = useAgentWorkspace(s => s.addMessage);

  useEffect(() => { if (!authLoading && !token) router.replace("/login"); }, [token, authLoading, router]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    getAgent(id).then(a => {
      if (!alive) return;
      if (!a) { setNotFound(true); return; }
      setAgent(a);
      setColumnAgent(a.type, a);
    }).catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || !agent || sending) return;
    setInput("");
    const userMsg: WorkspaceMessage = { role: "user", content: t };
    addMessage(agent.type, userMsg);
    setSending(true);
    try {
      const reply = await askClaude(agent, [...messages, userMsg]);
      addMessage(agent.type, { role: "assistant", content: reply });
    } catch (e) {
      addMessage(agent.type, { role: "assistant", content: `Fehler: ${(e as Error).message}` });
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !token) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
      <div className="thinking-spinner" style={{ width: 24, height: 24 }} />
    </div>
  );

  if (notFound) {
    return (
      <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950" style={{ height: "100vh" }}>
        <AgentNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">Agent nicht gefunden.</p>
        </div>
      </div>
    );
  }

  const opening = OPENING[column];

  return (
    <div className="flex flex-col bg-zinc-50 dark:bg-zinc-950" style={{ height: "100vh", overflow: "hidden" }}>
      <AgentNav />

      {/* Agent header */}
      <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 md:px-6 h-14 flex items-center gap-3">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />Agenten
        </button>

        {agent && (
          <>
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/60 ring-1 ring-green-100 dark:ring-green-900 flex items-center justify-center shrink-0 text-[11px] font-bold text-green-700 dark:text-green-400">
              {agent.avatar_placeholder || agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{agent.name}</p>
            </div>
            <Badge variant="secondary" className="capitalize">{agent.type}</Badge>
          </>
        )}

        <div className="flex-1" />

        {/* Static placeholder — no real progress tracking yet */}
        <Badge variant="outline" className="hidden sm:inline-flex">Fortschritt · 0%</Badge>
        <button title="Coming soon" disabled
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 cursor-not-allowed">
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          {/* Opening bubble + quick replies (only before the user has said anything) */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ background: "var(--green)" }}>A</div>
            <div className="flex-1">
              <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                {opening.text}
              </div>
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {opening.quickReplies.map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="choice-chip">{q}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: "var(--green)" }}>A</div>
              <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center">
                <div className="thinking-spinner" style={{ width: 16, height: 16 }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <footer className="shrink-0 px-4 md:px-8 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-2xl mx-auto w-full">
          <div className="focus-parent flex gap-3 items-end bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus-within:border-green-400 dark:focus-within:border-green-600 transition-colors">
            <textarea value={input} rows={1} disabled={sending}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Nachricht schreiben…"
              className="flex-1 bg-transparent border-none resize-none text-sm text-zinc-900 dark:text-zinc-100 outline-none leading-relaxed placeholder:text-zinc-400 disabled:opacity-50"
              style={{ minHeight: 24, maxHeight: 160 }} />
            <button onClick={() => send(input)} disabled={!input.trim() || sending}
              className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                input.trim() && !sending ? "bg-green-600 hover:bg-green-700 text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400")}>
              <ArrowUp className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MessageBubble({ message }: { message: WorkspaceMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
        style={{ background: isUser ? "#1e3a8a" : "var(--green)" }}>
        {isUser ? "U" : "A"}
      </div>
      <div className={cn(
        "text-sm leading-relaxed px-4 py-3 rounded-2xl max-w-[80%]",
        isUser
          ? "bg-green-600 text-white rounded-tr-sm"
          : "bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200 rounded-tl-sm"
      )}>
        {message.content}
      </div>
    </div>
  );
}
