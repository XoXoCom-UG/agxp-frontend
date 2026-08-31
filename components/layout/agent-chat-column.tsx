"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentWorkspace, type WorkspaceMessage } from "@/lib/agent-workspace-store";
import { askAgent } from "@/lib/ask-agent";
import type { AgentType } from "@/lib/agents";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ArrowUp, Download, UserRoundCog, HeartHandshake } from "lucide-react";

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

const COLUMN_META: Record<AgentType, { label: string; icon: React.ReactNode }> = {
  consultant: { label: "Consultant", icon: <UserRoundCog className="w-4 h-4" strokeWidth={1.5} /> },
  coach: { label: "Coach", icon: <HeartHandshake className="w-4 h-4" strokeWidth={1.5} /> },
};

/**
 * One live conversation column — Consultant or Coach. Both columns render at
 * once in the workspace (see app/dashboard/workspace/page.tsx), each talking
 * to its own agent independently.
 */
export function AgentChatColumn({ type }: { type: AgentType }) {
  const router = useRouter();
  const agent = useAgentWorkspace(s => s[type].agent);
  const messages = useAgentWorkspace(s => s[type].messages);
  const addMessage = useAgentWorkspace(s => s.addMessage);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meta = COLUMN_META[type];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || !agent || sending) return;
    setInput("");
    const userMsg: WorkspaceMessage = { role: "user", content: t };
    addMessage(type, userMsg);
    setSending(true);
    try {
      const reply = await askAgent(agent, [...messages, userMsg]);
      addMessage(type, { role: "assistant", content: reply });
    } catch (e) {
      addMessage(type, { role: "assistant", content: `Fehler: ${(e as Error).message}` });
    } finally {
      setSending(false);
    }
  }

  if (!agent) {
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
          {meta.icon}
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Noch kein {meta.label} gewählt.</p>
        <button onClick={() => router.push("/dashboard")}
          className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2 hover:bg-green-100 dark:hover:bg-green-900/60 transition-colors">
          {meta.label} wählen
        </button>
      </div>
    );
  }

  const opening = OPENING[type];

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Column header */}
      <div className="shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 h-14 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/60 ring-1 ring-green-100 dark:ring-green-900 flex items-center justify-center shrink-0 text-[11px] font-bold text-green-700 dark:text-green-400">
          {agent.avatar_placeholder || agent.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">{agent.name}</p>
        </div>
        <Badge variant="secondary" className="capitalize hidden sm:inline-flex">{type}</Badge>
        <Badge variant="outline" className="hidden lg:inline-flex">0%</Badge>
        <button title="Coming soon" disabled
          className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-300 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed">
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
              style={{ background: "var(--green)" }}>A</div>
            <div className="flex-1 min-w-0">
              <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-zinc-800 dark:text-zinc-200">
                {opening.text}
              </div>
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {opening.quickReplies.map(q => (
                    <button key={q} onClick={() => send(q)} className="choice-chip text-[12px]">{q}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {messages.map((m, i) => <Bubble key={i} message={m} />)}

          {sending && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ background: "var(--green)" }}>A</div>
              <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center">
                <div className="thinking-spinner" style={{ width: 14, height: 14 }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="focus-parent flex gap-2 items-end bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus-within:border-green-400 dark:focus-within:border-green-600 transition-colors">
          <textarea value={input} rows={1} disabled={sending}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={`Nachricht an ${meta.label}…`}
            className="flex-1 bg-transparent border-none resize-none text-sm text-zinc-900 dark:text-zinc-100 outline-none leading-relaxed placeholder:text-zinc-400 disabled:opacity-50"
            style={{ minHeight: 22, maxHeight: 120 }} />
          <button onClick={() => send(input)} disabled={!input.trim() || sending}
            className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              input.trim() && !sending ? "bg-green-600 hover:bg-green-700 text-white" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400")}>
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: WorkspaceMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
        style={{ background: isUser ? "#1e3a8a" : "var(--green)" }}>
        {isUser ? "U" : "A"}
      </div>
      <div className={cn(
        "text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl max-w-[85%]",
        isUser
          ? "bg-green-600 text-white rounded-tr-sm"
          : "bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200 rounded-tl-sm"
      )}>
        {message.content}
      </div>
    </div>
  );
}
