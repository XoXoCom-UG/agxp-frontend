"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useChatStore } from "@/lib/chat-store";
import { api } from "@/lib/api";
import { md } from "@/lib/markdown";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectJourney, type JourneyStage } from "@/components/layout/project-journey";
import { DEMO_MESSAGES } from "@/lib/demo";
import { Badge } from "@/components/ui";
import { cn, scopedKey } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap, ArrowUp, ArrowRight, MessageSquare, CheckCircle2, Copy, Check,
  Folder, Plus, LayoutDashboard, Sparkles, Wrench, ShieldCheck, Server, Lock, Pencil, RefreshCw,
} from "lucide-react";

// ── Phase list (long, non-repeating within a response) ───────────────────────
const PHASES_CHAT = [
  "Lese deine Frage…",
  "Verstehe den Kontext…",
  "Analysiere relevante Aspekte…",
  "Denke über Lösungsansätze nach…",
  "Strukturiere die Antwort…",
  "Überprüfe Vollständigkeit…",
  "Formuliere finale Antwort…",
];

const BTN_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

// ── Home hero: interactive background (aurora at rest → dot-field at cursor) ───
function WelcomeBackground() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let idle: ReturnType<typeof setTimeout>;
    function onMove(e: PointerEvent) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return; // pointer outside hero
      dotRef.current?.style.setProperty("--mx", `${x}px`);
      dotRef.current?.style.setProperty("--my", `${y}px`);
      if (glowRef.current) { glowRef.current.style.left = `${x}px`; glowRef.current.style.top = `${y}px`; }
      setInteracting(true);
      clearTimeout(idle);
      idle = setTimeout(() => setInteracting(false), 2200);
    }
    window.addEventListener("pointermove", onMove);
    return () => { window.removeEventListener("pointermove", onMove); clearTimeout(idle); };
  }, []);
  return (
    <div ref={wrapRef} aria-hidden="true"
      className={cn("mf-bg pointer-events-none absolute inset-0 overflow-hidden", interacting && "mf-interacting")}>
      <div className="mf-aurora mf-aurora-1" />
      <div className="mf-aurora mf-aurora-2" />
      <div ref={dotRef} className="mf-dotfield" />
      <div ref={glowRef} className="mf-cursor-glow" />
    </div>
  );
}

// ── Thinking bubble with accumulated phases ───────────────────────────────────
function ThinkingBubble({ phases, current }: { phases: string[]; current: number }) {
  const visiblePhases = phases.slice(0, Math.min(current + 1, phases.length));

  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm rounded-2xl rounded-tl-sm px-5 py-4 min-w-[220px]">
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {visiblePhases.map((phase, idx) => {
            const isDone = idx < current;
            const isCurrent = idx === current || idx === visiblePhases.length - 1;
            return (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
                className="flex items-center gap-2.5"
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" strokeWidth={2} />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse block" />
                  </span>
                )}
                <span className={cn(
                  "text-[12.5px] leading-snug transition-colors",
                  isDone
                    ? "text-zinc-400 dark:text-zinc-500 line-through"
                    : "text-zinc-700 dark:text-zinc-200 font-medium"
                )}>
                  {phase}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content.map((b: unknown) => {
      if (typeof b === "string") return b;
      if (b && typeof b === "object" && "text" in b && typeof (b as { text: unknown }).text === "string")
        return (b as { text: string }).text;
      return "";
    }).join("");
  return "";
}

/**
 * Tidy what's left after a [[MARKER]] is lifted out of a message.
 *
 * The agent puts its markers mid-message, often fenced by `---` rules. Removing the
 * marker left the rules behind with nothing between them, so the bubble showed two
 * horizontal lines around an empty band. `.trim()` doesn't help: the hole is in the
 * middle, not at the ends.
 */
function tidyAfterMarkers(text: string): string {
  return text
    // Two rules with nothing between them fenced the marker that just got lifted, so
    // BOTH are noise. A lone rule between two paragraphs is authored content and is
    // left alone. Table separators ("| --- |") never match: the line starts with "|".
    .replace(/\n[ \t]*-{3,}[ \t]*(?:\n[ \t]*)*\n[ \t]*-{3,}[ \t]*/g, "\n")
    .replace(/^(?:[ \t]*-{3,}[ \t]*\n?)+/, "")   // a rule now opening the message
    .replace(/(?:\n[ \t]*-{3,}[ \t]*)+$/, "")    // ...or closing it
    .replace(/\n{3,}/g, "\n\n")                  // collapse the hole it left
    .trim();
}

function ChoiceChips({ choices, onSelect }: { choices: string[]; onSelect: (c: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {choices.map(c => (
          <button key={c} disabled={!!picked} onClick={() => { setPicked(c); onSelect(c); }}
            className={cn("choice-chip", picked === c && "chosen")}>{c}</button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">Wähle eine Option — oder schreib deine eigene Antwort.</p>
    </div>
  );
}

// Multi-select variant: pick several options, then submit.
function MultiChoiceChips({ choices, onSubmit }: { choices: string[]; onSubmit: (c: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  function toggle(c: string) {
    setSelected(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }
  return (
    <div className="mt-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 p-3 space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {choices.map(c => {
          const on = selected.includes(c);
          return (
            <button key={c} disabled={sent} onClick={() => toggle(c)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] transition-colors duration-150",
                on
                  ? "border-green-500 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 font-medium"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-green-300"
              )}>
              <span className={cn("w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0",
                on ? "bg-green-600 border-green-600" : "border-zinc-300 dark:border-zinc-600")}>
                {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={selected.length === 0 || sent}
          onClick={() => { setSent(true); onSubmit(selected.join(", ")); }}
          className={cn("text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors duration-150",
            selected.length > 0 && !sent
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 cursor-default")}>
          {selected.length > 0 ? `${selected.length} auswählen →` : "Auswählen"}
        </button>
        <span className="text-xs text-zinc-400">Mehrere möglich — oder schreib deine eigene Antwort.</span>
      </div>
    </div>
  );
}

// ── Message actions (copy — right-aligned) ────────────────────────────────────
function MsgActions({ text, onRegenerate }: { text: string; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-end w-full gap-1 mt-1.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
      {/* Asked for in the review: when a reply is cut off — dropped connection,
          server hiccup — the way out was copying the question and pasting it again.
          Only offered on the LAST reply, because regenerating an older one would
          throw away everything said after it. */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          title="Antwort neu generieren"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
        >
          <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
          Neu generieren
        </button>
      )}
      <button
        onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        title="Kopieren"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150"
      >
        {copied
          ? <Check className="w-3 h-3 text-green-500" strokeWidth={2} />
          : <Copy className="w-3 h-3" strokeWidth={1.5} />}
        {copied ? "Kopiert" : "Kopieren"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { token, loading, user, profileName: displayName } = useAuth();
  const store = useChatStore();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [phaseIdx, setPhaseIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Text selection → "discuss with agent" floating button (feeds the shared panel)
  const msgListRef = useRef<HTMLDivElement>(null);
  const [selBtn, setSelBtn] = useState<{ x: number; y: number; text: string } | null>(null);

  // Inline project creation on the welcome screen
  // "Starte Projekt" clicked → reveal the left agent's composer directly.
  const [startedProject, setStartedProject] = useState(false);

  /*
   * Does this conversation already have a concept / a roadmap?
   *
   * Drives the journey indicator. Read from the server rather than tracked
   * locally: a counter we increment ourselves can disagree with the data, and a
   * progress indicator that lies is worse than none. Two cheap GETs that touch only
   * the database — no model call — and both answer 200 with null when there is
   * nothing yet.
   */
  const [hasConcept, setHasConcept] = useState(false);
  const [hasRoadmap, setHasRoadmap] = useState(false);
  useEffect(() => {
    if (!token || !store.sessionId || !store.messages.length) {
      setHasConcept(false); setHasRoadmap(false); return;
    }
    let alive = true;
    api.getConcept(token, store.sessionId)
      .then(d => { if (alive) setHasConcept(!!d?.concept); }).catch(() => {});
    api.getRoadmap(token, store.sessionId)
      .then(d => { if (alive) setHasRoadmap(!!d?.roadmap); }).catch(() => {});
    return () => { alive = false; };
  }, [token, store.sessionId, store.messages.length]);

  function openStage(stage: JourneyStage) {
    if (stage === "concept") router.push(`/concept?session=${store.sessionId}`);
    else if (stage === "roadmap") router.push(`/dashboard?session=${store.sessionId}`);
    // "interview" is this page — nothing to navigate to.
  }

  // "Hire an Agent" start: the left agent introduces itself, numbered and
  // renameable (UI-only — does not touch the agent's prompting). The rename
  // is scoped per account so it can't leak into another user's session.
  const [consultantName, setConsultantName] = useState("CONSULTANT-1");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    setConsultantName(localStorage.getItem(scopedKey("matfit_agent_consultant", user?.id ?? null)) || "CONSULTANT-1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  function saveConsultantName() {
    const n = nameDraft.trim() || "CONSULTANT-1";
    localStorage.setItem(scopedKey("matfit_agent_consultant", user?.id ?? null), n);
    setConsultantName(n);
    setRenaming(false);
  }

  useEffect(() => { if (!loading && !token) router.replace("/login"); }, [token, loading]);
  // Keep the message list pinned to the newest content — scroll ONLY the list
  // container, never the whole page (that caused the jump-to-top annoyance).
  useEffect(() => {
    const el = msgListRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [store.messages, store.sending]);

  // Feed the right-side assistant with the current conversation as context.
  useEffect(() => {
    const recent = store.messages.slice(-6)
      .map(m => `${m.role === "user" ? "Nutzer" : "matfit.ai"}: ${toText(m.content).slice(0, 400)}`)
      .filter(l => l.split(": ")[1]?.trim())
      .join("\n");
    store.setLeftContext(recent ? `Aktuelle Konversation im Chat:\n${recent}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.messages]);

  const activeProject = store.projects.find(p => p.project_id === store.activeProjectId) ?? null;

  // Back to the true welcome screen (e.g. logo → newChat) resets the reveal.
  useEffect(() => {
    if (!store.activeProjectId && store.messages.length === 0) setStartedProject(false);
  }, [store.activeProjectId, store.messages.length]);

  const allPhases = PHASES_CHAT;

  function startThinking() {
    store.setSending(true);
    setPhaseIdx(0);
    timerRef.current = setInterval(() => {
      setPhaseIdx(i => Math.min(i + 1, allPhases.length - 1));
    }, 2000);
  }
  function stopThinking() {
    store.setSending(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPhaseIdx(0);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || !token || store.sending) return;
    setInput("");
    const userMsg = { role: "user" as const, content: t };
    if (store.messages.length === 0) store.setSessionTitle(t.slice(0, 55));
    store.addMessage(userMsg);
    startThinking();

    // Create the project now, on the first message of a guided interview — not when
    // the user pressed "Starte Projekt". Naming it after what they wrote beats
    // "Neues Projekt", which is what every eagerly-created project was called.
    let projectId = store.activeProjectId;
    if (!projectId && store.guidedProject && store.messages.length === 0) {
      try {
        const p = await api.createProject(token, t.slice(0, 48));
        store.setProjects([p, ...store.projects]);
        store.setActiveProject(p.project_id);
        projectId = p.project_id;
      } catch {}
    }

    try {
      const res = await api.chat(token, { messages: [...store.messages, userMsg], session_id: store.sessionId, project_id: projectId, guided: store.guidedProject });
      // A list that doesn't end in a reply must never be rendered as if it were a
      // conversation: that showed the user's own message with silence underneath and
      // no hint that anything had failed. Throwing routes it to the catch below,
      // which puts a visible error in the thread.
      const last = res.messages?.[res.messages.length - 1];
      if (!last || last.role !== "assistant") {
        throw new Error("Keine Antwort erhalten — bitte nochmal senden.");
      }
      store.setMessages(res.messages);
      store.setSessionId(res.session_id);
      // NOTE: guided mode stays ON for the whole interview — it used to reset
      // after the first message, which made the agent drop the interview and
      // jump straight to giving ideas. It is turned off only when the concept
      // is generated or a new chat starts.
      api.getHistory(token).then(d => store.setHistory(d.sessions)).catch(() => {});
      // Refresh consent flags (the agent may have recorded permissions this turn)
      api.getProjects(token).then(d => store.setProjects(d.projects)).catch(() => {});
    } catch (e: unknown) {
      store.addMessage({ role: "assistant", content: `**Fehler:** ${(e as Error).message}` });
    } finally { stopThinking(); }
  }

  /**
   * Re-run the last turn.
   *
   * Drops every trailing assistant message — the failed reply, or an error bubble —
   * and re-sends the conversation that ends with the user's question. Asked for in
   * the review: when a reply is cut off by a dropped connection, the only way out
   * was copying the question and pasting it again, which is exactly the kind of
   * friction the product is supposed to remove.
   */
  async function regenerate() {
    if (!token || store.sending) return;
    const msgs = store.messages;
    let cut = msgs.length;
    while (cut > 0 && msgs[cut - 1].role === "assistant") cut--;
    const upTo = msgs.slice(0, cut);
    if (!upTo.length) return;                 // nothing to re-ask

    store.setMessages(upTo);
    startThinking();
    try {
      const res = await api.chat(token, {
        messages: upTo,
        session_id: store.sessionId,
        project_id: store.activeProjectId,
        guided: store.guidedProject,
      });
      const last = res.messages?.[res.messages.length - 1];
      if (!last || last.role !== "assistant") {
        throw new Error("Keine Antwort erhalten — bitte nochmal senden.");
      }
      store.setMessages(res.messages);
      store.setSessionId(res.session_id);
      api.getHistory(token).then(d => store.setHistory(d.sessions)).catch(() => {});
    } catch (e: unknown) {
      // Put the question back with the error under it, so the button is still there.
      store.setMessages([...upTo, { role: "assistant", content: `**Fehler:** ${(e as Error).message}` }]);
    } finally { stopThinking(); }
  }

  // "Starte Projekt" → reveal the left agent's text field right away and start the
  // guided interview.
  //
  // It does NOT create the project yet. It used to, eagerly, which meant every
  // abandoned start — a mis-click, a reload, a change of mind — left a permanent
  // empty "Neues Projekt" behind. The projects list filled up with them. The
  // project is now created on the first message instead (see `send`), which also
  // lets it be named after what the user actually wrote.
  function startProjectDirect() {
    if (!token) return;
    store.newChat();
    store.setGuidedProject(true);
    setStartedProject(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  // Selection inside the message list → floating "discuss" button
  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    const container = msgListRef.current;
    if (!sel || !container || text.length < 8 || !sel.anchorNode || !container.contains(sel.anchorNode)) {
      setSelBtn(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const parent = container.getBoundingClientRect();
    setSelBtn({
      x: rect.left - parent.left + rect.width / 2,
      y: rect.top - parent.top + container.scrollTop,
      text: text.slice(0, 600),
    });
  }

  function askAboutSelection() {
    if (!selBtn) return;
    store.pushAssistant({ quote: selBtn.text });
    setSelBtn(null);
    window.getSelection()?.removeAllRanges();
  }

  // During the onboarding tour we show a bundled example conversation.
  const demo = store.demoActive;
  const msgs = demo ? DEMO_MESSAGES : store.messages;
  const turns = store.messages.filter(m => m.role === "user").length;
  const canSend = !!input.trim() && !store.sending;
  const lastAssistantIdx = (() => {
    for (let i = msgs.length - 1; i >= 0; i--)
      if (msgs[i].role === "assistant") return i;
    return -1;
  })();

  if (loading || !token) return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Topbar skeleton */}
      <div className="h-14 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3 px-5 shrink-0">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-8 w-24 rounded-lg ml-2" />
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-8 rounded-full" />
      </div>
      {/* Body skeleton */}
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="skeleton h-9 w-72 max-w-[80%]" />
          <div className="skeleton h-9 w-96 max-w-[80%]" />
          <div className="skeleton h-4 w-64 max-w-[70%] mt-2" />
          <div className="skeleton h-16 w-full max-w-sm rounded-2xl mt-6" />
        </div>
        <div className="hidden lg:flex flex-col gap-3 w-[320px] border-l border-zinc-100 dark:border-zinc-800 p-4">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-16 w-full rounded-xl mt-2" />
          <div className="skeleton h-9 w-full rounded-lg" />
          <div className="skeleton h-9 w-full rounded-lg" />
          <div className="skeleton h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );

  // The welcome screen (no project, no conversation) only offers "Starte Projekt".
  // Showing a chat bar there is misleading, so the composer is hidden until the
  // user is actually in a project or a conversation.
  const onWelcome = msgs.length === 0 && !store.sending && !activeProject;

  return (
    <AppShell active="chat">
        {/* Where you are, for the whole run of a project. Only once the interview
            has actually started — on the welcome screen there is no project yet, and
            a journey with nothing on it is noise. */}
        {msgs.length > 0 && !demo && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="no-print shrink-0 border-b border-zinc-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm px-4 md:px-6 py-2 flex justify-center"
          >
            <ProjectJourney
              hasMessages={msgs.length > 0}
              hasConcept={hasConcept}
              hasRoadmap={hasRoadmap}
              onOpen={openStage}
            />
          </motion.div>
        )}

        {/* Messages / Project hub / Welcome */}
        <div className="flex-1 overflow-y-auto relative" ref={msgListRef} onMouseUp={handleMouseUp}>
          {/* Floating "discuss selection" button */}
          <AnimatePresence>
            {selBtn && (
              <motion.button
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={BTN_SPRING}
                onClick={askAboutSelection}
                className="absolute z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-lg -translate-x-1/2 -translate-y-full"
                style={{ left: selBtn.x, top: selBtn.y - 8 }}
              >
                <MessageSquare className="w-3 h-3" strokeWidth={2} />
                Mit Agent diskutieren
              </motion.button>
            )}
          </AnimatePresence>

          {msgs.length === 0 && !store.sending && activeProject && !startedProject ? (
            /* ── Project hub: the three buttons, centered ── */
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-16">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.5, bounce: 0.08 }}
                className="w-full max-w-md text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-3 text-green-600">
                  <Folder className="w-4 h-4" strokeWidth={1.5} />
                  <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">Projekt</p>
                </div>
                <h2 className="text-[26px] font-extrabold text-zinc-900 dark:text-zinc-50 leading-tight mb-2"
                  style={{ letterSpacing: "-0.02em" }}>
                  {activeProject.name}
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                  Wie möchtest du weitermachen?
                </p>
                <div className="grid grid-cols-1 gap-3 text-left">
                  {[
                    {
                      icon: <MessageSquare className="w-4 h-4" strokeWidth={1.5} />,
                      label: "Starte Projekt",
                      sub: "Geführtes Interview — der Agent lernt dich und dein Projekt kennen.",
                      accent: true,
                      action: () => { store.setGuidedProject(true); inputRef.current?.focus(); },
                    },
                    {
                      icon: <Zap className="w-4 h-4" strokeWidth={1.5} />,
                      label: "Konzept",
                      sub: "Ist-Zustand, Ziel-Zustand & Tooling als strukturierte Tabellen.",
                      accent: false,
                      action: () => router.push(`/concept?session=${store.sessionId}`),
                    },
                    {
                      icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />,
                      label: "Dashboard",
                      sub: "Roadmap mit Phasen, Tools und Fortschritt.",
                      accent: false,
                      action: () => router.push("/dashboard"),
                    },
                  ].map((c, idx) => (
                    <motion.button
                      key={c.label}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", duration: 0.5, bounce: 0.12, delay: 0.1 + idx * 0.07 }}
                      whileHover={{ y: -3, scale: 1.012, transition: BTN_SPRING }}
                      whileTap={{ scale: 0.975, transition: BTN_SPRING }}
                      onClick={c.action}
                      className={cn(
                        "group/hub relative flex items-center gap-4 rounded-2xl px-5 py-4 border text-left overflow-hidden transition-all duration-200",
                        c.accent
                          ? "border-green-500 shadow-lg shadow-green-600/25 hover:shadow-xl hover:shadow-green-600/30"
                          : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-800 shadow-sm hover:shadow-md"
                      )}
                      style={c.accent ? { background: "linear-gradient(135deg, #16a34a 0%, #15803d 60%, #14532d 100%)" } : undefined}
                    >
                      {/* Sheen sweep on hover (primary card) */}
                      {c.accent && (
                        <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover/hub:translate-x-full transition-transform duration-700 ease-out"
                          style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }} />
                      )}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/hub:scale-110 group-hover/hub:rotate-[-4deg]",
                        c.accent
                          ? "bg-white/20 text-white ring-1 ring-white/30"
                          : "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 ring-1 ring-green-100 dark:ring-green-900"
                      )}>
                        {c.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-semibold text-sm", c.accent ? "text-white" : "text-zinc-900 dark:text-zinc-50")}>
                          {c.label}
                        </p>
                        <p className={cn("text-xs leading-relaxed", c.accent ? "text-green-100" : "text-zinc-500 dark:text-zinc-400")}>
                          {c.sub}
                        </p>
                      </div>
                      {/* Arrow slides in on hover */}
                      <span className={cn(
                        "shrink-0 opacity-0 -translate-x-1 group-hover/hub:opacity-100 group-hover/hub:translate-x-0 transition-all duration-200",
                        c.accent ? "text-white" : "text-green-600"
                      )}>
                        <ArrowUp className="w-4 h-4 rotate-90" strokeWidth={2} />
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : msgs.length === 0 && !store.sending && !startedProject ? (
            <div className="relative flex flex-col items-center justify-center min-h-full px-6 py-16 overflow-hidden">

              {/* Interactive ambient background */}
              <WelcomeBackground />

              <div className="relative w-full max-w-lg text-center">

                {/* Logo wordmark */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.6, bounce: 0.1 }}
                  className="flex items-center justify-center gap-px mb-10"
                >
                  <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50" style={{ letterSpacing: "-0.04em" }}>matfit</span>
                  <span className="text-3xl font-bold text-green-600" style={{ letterSpacing: "-0.04em" }}>.ai</span>
                </motion.div>

                {/* AI Agent intro — "Hire an Agent" (UI only, no prompting change) */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.55, bounce: 0.05, delay: 0.08 }}
                >
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-green-600 mb-4">
                    AI Agent
                  </p>
                  <h2
                    className="text-[28px] md:text-[36px] font-extrabold text-zinc-900 dark:text-zinc-50 leading-[1.12] mb-4"
                    style={{ letterSpacing: "-0.03em" }}
                  >
                    Hey{displayName ? ` ${displayName}` : ""}, ich bin{" "}
                    {renaming ? (
                      <input
                        autoFocus
                        value={nameDraft}
                        onChange={e => setNameDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveConsultantName(); if (e.key === "Escape") setRenaming(false); }}
                        onBlur={saveConsultantName}
                        maxLength={24}
                        className="inline-block w-[9ch] max-w-[60vw] bg-transparent border-b-2 border-green-400 text-green-600 text-center outline-none"
                      />
                    ) : (
                      <span className="text-green-600">{consultantName}</span>
                    )}.
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed max-w-md mx-auto">
                    Jeder Agent ist durchnummeriert und erinnert sich an jede vergangene Interaktion.
                  </p>
                  {!renaming && (
                    <button
                      onClick={() => { setNameDraft(consultantName); setRenaming(true); }}
                      className="mb-10 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-green-700 dark:hover:text-green-400 transition-colors"
                    >
                      <Pencil className="w-3 h-3" strokeWidth={1.7} />
                      Diesen Agenten umbenennen
                    </button>
                  )}
                </motion.div>

                {/* Primary action + Schnelle Frage */}
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.06, delay: 0.18 }}
                  whileHover={{ y: -3, transition: BTN_SPRING }}
                  whileTap={{ scale: 0.985, transition: BTN_SPRING }}
                  onClick={startProjectDirect}
                  className="group/start relative w-full max-w-sm mx-auto flex items-center gap-4 rounded-2xl px-5 py-4 overflow-hidden border border-green-500 text-left shadow-lg shadow-green-600/25 hover:shadow-xl hover:shadow-green-600/30 transition-shadow duration-200"
                  style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 60%, #14532d 100%)" }}
                >
                  {/* Sheen sweep on hover */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover/start:translate-x-full transition-transform duration-700 ease-out"
                    style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }} />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/20 text-white ring-1 ring-white/30 transition-transform duration-200 group-hover/start:scale-110 group-hover/start:rotate-[-4deg]">
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-white">Starte Projekt</p>
                    <p className="text-xs leading-relaxed text-green-100">Geführtes Interview → Konzept → Roadmap.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0 text-white opacity-70 -translate-x-1 group-hover/start:opacity-100 group-hover/start:translate-x-0 transition-all duration-200" strokeWidth={2} />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.06, delay: 0.24 }}
                  whileTap={{ scale: 0.985, transition: BTN_SPRING }}
                  onClick={() => store.popAssistantGreeting()}
                  className="mt-3 w-full max-w-sm mx-auto flex items-center justify-center gap-2 rounded-2xl px-5 py-3 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:border-green-300 dark:hover:border-green-800 hover:text-green-700 dark:hover:text-green-400 transition-colors duration-150 text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" strokeWidth={1.5} />
                  Schnelle Frage — frag den Assistenten
                </motion.button>

                {/* What you get — fills the space and states the value */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.34, duration: 0.4 }}
                  className="mt-8 flex items-center justify-center gap-6 text-zinc-500 dark:text-zinc-400"
                >
                  {[
                    { Icon: Zap, label: "Konzept" },
                    { Icon: LayoutDashboard, label: "Roadmap" },
                    { Icon: Wrench, label: "Tooling" },
                  ].map(({ Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} />
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                  ))}
                </motion.div>

                {/* Trust / compliance strip */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-zinc-400 dark:text-zinc-500"
                >
                  {[
                    { Icon: ShieldCheck, label: "DSGVO-konform" },
                    { Icon: Server, label: "Daten in der EU" },
                    { Icon: Lock, label: "Projekt-isoliert" },
                  ].map(({ Icon, label }) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" strokeWidth={1.5} />
                      {label}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6 w-full max-w-5xl mx-auto">
              {demo && (
                <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                  Beispiel — nur zur Ansicht während der Tour. Deine echten Gespräche startest du danach.
                </div>
              )}

              {/* Empty project chat — an inviting prompt instead of a blank screen */}
              {msgs.length === 0 && !demo && !store.sending && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.04 }}
                  className="flex flex-col items-center text-center py-20 max-w-md mx-auto"
                >
                  <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center mb-4 ring-1 ring-green-100 dark:ring-green-900">
                    <Sparkles className="w-5 h-5 text-green-600" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-1.5" style={{ letterSpacing: "-0.02em" }}>
                    Erzähl mir von deinem Vorhaben
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                    Beschreibe kurz dein Projekt oder deine Herausforderung — ich stelle dir dann die richtigen Fragen, und wir bauen gemeinsam Konzept &amp; Roadmap.
                  </p>

                  {/* The button promised three stages; this is where that promise
                      lands, so starting a project shows what it leads to. */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, type: "spring", duration: 0.45, bounce: 0 }}
                    className="w-full mb-6"
                  >
                    <ProjectJourney hasMessages={false} hasConcept={false} hasRoadmap={false} variant="preview" />
                  </motion.div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {["Wir wollen in die Cloud migrieren", "Wir brauchen ein IT-Sicherheitskonzept", "Welches ERP passt zu uns?"].map((ex, i) => (
                      <motion.button
                        key={ex}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16 + i * 0.06, type: "spring", duration: 0.4, bounce: 0 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                        className="px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-[12.5px] text-zinc-600 dark:text-zinc-300 hover:border-green-300 dark:hover:border-green-700 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50/60 dark:hover:bg-green-950/30 transition-colors duration-150"
                      >
                        {ex}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {msgs.map((m, i) => {
                const isUser = m.role === "user";
                let content = toText(m.content);
                let choices: string[] = [];
                let multi: string[] = [];
                const cm = content.match(/\[\[CHOICES:\s*([\s\S]*?)\]\]/i);
                if (cm) { choices = cm[1].split("|").map(s => s.trim()).filter(Boolean); content = content.replace(cm[0], "").trim(); }
                const mm = content.match(/\[\[MULTI:\s*([\s\S]*?)\]\]/i);
                if (mm) { multi = mm[1].split("|").map(s => s.trim()).filter(Boolean); content = content.replace(mm[0], "").trim(); }
                // The agent points to the Concept/Roadmap features instead of
                // writing them out in the chat: [[OPEN:concept]] / [[OPEN:roadmap]].
                let openTarget: "concept" | "roadmap" | null = null;
                const om = content.match(/\[\[OPEN:\s*(concept|roadmap)\s*\]\]/i);
                if (om) { openTarget = om[1].toLowerCase() as "concept" | "roadmap"; content = content.replace(om[0], "").trim(); }
                // Markers are gone; close the holes they left before rendering.
                if (cm || mm || om) content = tidyAfterMarkers(content);
                // Skip empty turns (tool-only / stripped messages) — no empty bubbles.
                if (!content.trim() && choices.length === 0 && multi.length === 0 && !openTarget) return null;
                const isLastAssistant = i === lastAssistantIdx && !store.sending;
                return (
                  <div key={i} className={cn("group/msg flex gap-3 animate-in", isUser && "flex-row-reverse")}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                      style={{ background: isUser ? "#15803d" : "var(--green)", fontFamily: isUser ? "inherit" : "Georgia,serif" }}>
                      {isUser ? "U" : "A"}
                    </div>
                    <div className={cn("flex flex-col min-w-0", isUser ? "items-end max-w-[78%]" : "items-start flex-1")}>
                      <p className="text-xs text-zinc-400 font-medium mb-1.5">{isUser ? "Du" : "matfit.ai"}</p>
                      <div className={cn(
                        "leading-relaxed",
                        isUser
                          ? "bg-green-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px]"
                          : "bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200 px-5 py-4 rounded-2xl rounded-tl-sm w-full"
                      )}
                        dangerouslySetInnerHTML={{ __html: md(content) }} />
                      {!isUser && <MsgActions text={content} onRegenerate={isLastAssistant ? regenerate : undefined} />}
                      {choices.length > 0 && <ChoiceChips choices={choices} onSelect={send} />}
                      {multi.length > 0 && isLastAssistant && <MultiChoiceChips choices={multi} onSubmit={send} />}
                      {openTarget === "concept" && (
                        <button onClick={() => router.push(`/concept?session=${store.sessionId}&gen=1`)}
                          className="group/cta mt-3 relative inline-flex items-center gap-3 overflow-hidden text-sm font-semibold text-white rounded-2xl pl-3 pr-5 py-2.5 shadow-lg shadow-green-600/25 hover:shadow-xl hover:shadow-green-600/30 active:scale-[0.98] transition-all duration-200"
                          style={{ background: "linear-gradient(140deg, #16a34a 0%, #15803d 60%, #14532d 100%)" }}>
                          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-700 ease-out"
                            style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)" }} />
                          <span className="w-8 h-8 rounded-xl bg-white/20 ring-1 ring-white/25 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:scale-105 group-hover/cta:-rotate-[4deg]">
                            <Zap className="w-4 h-4" strokeWidth={1.6} />
                          </span>
                          Transformation Concept erstellen
                          <ArrowRight className="w-4 h-4 opacity-80 -translate-x-0.5 group-hover/cta:translate-x-0.5 transition-transform duration-200" strokeWidth={2} />
                        </button>
                      )}
                      {openTarget === "roadmap" && (
                        <button onClick={() => router.push(`/dashboard?session=${store.sessionId}`)}
                          className="group/cta mt-3 relative inline-flex items-center gap-3 overflow-hidden text-sm font-semibold text-white rounded-2xl pl-3 pr-5 py-2.5 shadow-lg shadow-green-600/25 hover:shadow-xl hover:shadow-green-600/30 active:scale-[0.98] transition-all duration-200"
                          style={{ background: "linear-gradient(140deg, #16a34a 0%, #15803d 60%, #14532d 100%)" }}>
                          <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-700 ease-out"
                            style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)" }} />
                          <span className="w-8 h-8 rounded-xl bg-white/20 ring-1 ring-white/25 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/cta:scale-105 group-hover/cta:-rotate-[4deg]">
                            <LayoutDashboard className="w-4 h-4" strokeWidth={1.6} />
                          </span>
                          Roadmap erstellen
                          <ArrowRight className="w-4 h-4 opacity-80 -translate-x-0.5 group-hover/cta:translate-x-0.5 transition-transform duration-200" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {store.sending && (
                <div className="flex gap-3 animate-in">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ background: "var(--green)", fontFamily: "Georgia,serif" }}>A</div>
                  <div className="flex flex-col">
                    <p className="text-xs text-zinc-400 font-medium mb-1.5">matfit.ai</p>
                    <ThinkingBubble phases={allPhases} current={phaseIdx} />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer — the left agent's text field. Hidden on the welcome screen;
            revealed once the user clicks "Starte Projekt" (or is in a chat). */}
        {(!onWelcome || startedProject) && (
        <footer className="shrink-0 px-4 md:px-8 lg:px-12 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="max-w-5xl mx-auto w-full">
            {/* Research is hidden for now — it becomes its own feature later. */}
            {turns > 0 && (
              <div className="flex items-center justify-end mb-2">
                <Badge variant="secondary">{turns} turns</Badge>
              </div>
            )}
            <div data-tour="composer" className="focus-parent flex gap-3 items-end bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus-within:border-green-400 dark:focus-within:border-green-600 focus-within:shadow-sm transition-all duration-150">
              <textarea ref={inputRef} value={input} rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                onInput={e => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 180)}px`; }}
                placeholder="Beschreibe dein Projekt…"
                className="flex-1 bg-transparent border-none resize-none text-sm text-zinc-900 dark:text-zinc-100 outline-none leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                style={{ minHeight: 26, maxHeight: 180, fontFamily: "inherit" }} />
              <motion.button
                whileTap={canSend ? { scale: 0.92 } : {}}
                transition={BTN_SPRING}
                onClick={() => send(input)} disabled={!canSend}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150",
                  canSend
                    ? "bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-600/30"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-default"
                )}
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2} />
              </motion.button>
            </div>
            <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 text-center mt-2">
              matfit.ai kann Fehler machen — prüfe wichtige Informationen. Antworten basieren auf deinem Projekt-Kontext.
            </p>
          </div>
        </footer>
        )}
    </AppShell>
  );
}
