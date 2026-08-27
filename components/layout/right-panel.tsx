"use client";
import { useEffect, useRef, useState } from "react";
import { api, Message, ConceptData, RoadmapData } from "@/lib/api";
import { md } from "@/lib/markdown";
import { cn, scopedKey } from "@/lib/utils";
import { useChatStore, AssistantContext } from "@/lib/chat-store";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUp, Sparkles, Pencil, MessageCircle, HelpCircle, MousePointerClick, Check, RotateCcw } from "lucide-react";

/*
 * Persönlicher Assistent — the right-side panel, present on every screen
 * (Patryk sketch, 2026-07-07). It is ALWAYS a live chat: the user can ask
 * anything at any time. Selecting text / discussing a roadmap tool just
 * pre-fills a question into this same chat — it is an extra convenience, not
 * a precondition.
 */

const CAPABILITIES = [
  { Icon: Pencil, text: "Bearbeite Transformationen" },
  { Icon: MessageCircle, text: "Diskutiere Lösungswege" },
  { Icon: HelpCircle, text: "Stelle Fragen bei Unklarheiten" },
  { Icon: MousePointerClick, text: "Markiere jeglichen Text, um mit mir zu diskutieren" },
];

function toText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content.map((b: unknown) =>
      b && typeof b === "object" && "text" in b && typeof (b as { text: unknown }).text === "string"
        ? (b as { text: string }).text : ""
    ).join("");
  return "";
}

/** The always-on assistant chat. Reads the shared discuss-context from the
 *  store so any page can push a selection into it. */
export function AssistantPanel({ token, projectId, scopeKey }: { token: string | null; projectId: string | null; scopeKey: string }) {
  const context = useChatStore(s => s.assistantContext);
  const contextNonce = useChatStore(s => s.assistantContextNonce);

  const editContext = useChatStore(s => s.editContext);
  const clearEdit = useChatStore(s => s.clearEdit);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const persona = useChatStore(s => s.persona);
  const setPersona = useChatStore(s => s.setPersona);
  const startTour = useChatStore(s => s.startTour);
  // First-run greeting: the assistant introduces itself after a short delay
  // (replaces the old welcome modal). Only ever shown once per browser.
  const [greeting, setGreeting] = useState(false);
  // "Hire an Agent": the right agent is numbered (COACH-1) and renameable.
  // The rename is scoped per account so it can't leak between users sharing
  // this browser.
  const { user, profileName: displayName } = useAuth();
  const [coachName, setCoachName] = useState("COACH-1");
  const [renamingCoach, setRenamingCoach] = useState(false);
  const [coachDraft, setCoachDraft] = useState("");
  useEffect(() => {
    setCoachName(localStorage.getItem(scopedKey("matfit_agent_coach", user?.id ?? null)) || "COACH-1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  function saveCoachName() {
    const n = coachDraft.trim() || "COACH-1";
    localStorage.setItem(scopedKey("matfit_agent_coach", user?.id ?? null), n);
    setCoachName(n);
    setRenamingCoach(false);
  }
  // Assisted-edit state: a proposed change awaiting "Übernehmen", and the last
  // applied change (for a one-click "Rückgängig").
  const [pendingEdit, setPendingEdit] = useState<{ kind: "concept" | "roadmap"; updated: ConceptData | RoadmapData } | null>(null);
  const [undoData, setUndoData] = useState<{ kind: "concept" | "roadmap"; prev: ConceptData | RoadmapData | null } | null>(null);
  const sessionRef = useRef(`help-${Date.now()}`);

  useEffect(() => {
    const p = localStorage.getItem("matfit_persona");
    if (p === "kritiker" || p === "berater") setPersona(p);
  }, [setPersona]);

  // Show the first-run greeting 3.5s after arrival (a gentle "plopp"), unless
  // the user has already seen the tour prompt before.
  useEffect(() => {
    if (localStorage.getItem("matfit_tour_done")) return;
    const t = setTimeout(() => setGreeting(true), 3500);
    return () => clearTimeout(t);
  }, []);

  // "Schnelle Frage" clicked on the home screen → pop the greeting on demand.
  const greetNonce = useChatStore(s => s.assistantGreetNonce);
  useEffect(() => { if (greetNonce > 0) setGreeting(true); }, [greetNonce]);
  function acceptTour() { setGreeting(false); startTour(); }
  function dismissGreeting() { localStorage.setItem("matfit_tour_done", "1"); setGreeting(false); }

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastNonce = useRef(0);

  // The side-thread is kept per conversation (scopeKey = main session id):
  // load it when the scope changes so the assistant "remembers" this project.
  useEffect(() => {
    if (!token || !scopeKey) { setMessages([]); return; }
    let alive = true;
    api.getAssistantThread(token, scopeKey)
      .then(r => { if (alive) setMessages(r.messages ?? []); })
      .catch(() => { if (alive) setMessages([]); });
    return () => { alive = false; };
  }, [token, scopeKey]);

  // Keep the panel scrolled to the newest message (only scrolls the panel,
  // never the main page).
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // A freshly pushed context (selection / discuss button) auto-asks its question.
  useEffect(() => {
    if (!context || contextNonce === lastNonce.current) return;
    lastNonce.current = contextNonce;
    const q = context.question
      ? `${context.question}\n\n> ${context.quote}`
      : `Erkläre mir das genauer und nenne mögliche Alternativen:\n\n> ${context.quote}`;
    send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextNonce]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending || !token) return;
    setInput("");
    const userMsg: Message = { role: "user", content: t };
    const shown = [...messages, userMsg];
    setMessages(shown);
    setSending(true);
    const st = useChatStore.getState();
    const ec = st.editContext;
    try {
      // ── Assisted-edit mode: discuss + propose a targeted change ──────────
      if (ec) {
        const current = ec.kind === "concept" ? st.activeConcept : st.activeRoadmap;
        if (!current) throw new Error("Es gibt gerade nichts zum Bearbeiten.");
        const res = await api.assistantEdit(token, {
          kind: ec.kind, current, target: ec.target, instruction: t, messages: shown,
        });
        setMessages([...shown, { role: "assistant", content: res.reply }]);
        const changed = JSON.stringify(res.updated) !== JSON.stringify(current);
        setPendingEdit(changed ? { kind: ec.kind, updated: res.updated } : null);
        return;
      }
      // ── Normal side-chat ─────────────────────────────────────────────────
      const leftCtx = st.leftContext;
      const seed: Message[] = leftCtx
        ? [
            { role: "user", content: `[Kontext, den der Nutzer gerade links sieht — nur zur Orientierung, nicht wiederholen]\n\n${leftCtx}` },
            { role: "assistant", content: "Alles klar, ich habe den Kontext im Blick." },
          ]
        : [];
      const res = await api.chat(token, { messages: [...seed, ...shown], session_id: sessionRef.current, project_id: projectId, persona });
      // Only an assistant turn may be appended. Appending whatever came last put a
      // second copy of the user's own message in the thread whenever the backend
      // returned a list with no reply in it.
      const reply = res.messages?.[res.messages.length - 1];
      if (!reply || reply.role !== "assistant") {
        throw new Error("Keine Antwort erhalten — bitte nochmal senden.");
      }
      const finalMsgs = [...shown, reply];
      setMessages(finalMsgs);
      if (scopeKey) api.saveAssistantThread(token, scopeKey, finalMsgs).catch(() => {});
    } catch (e: unknown) {
      setMessages([...shown, { role: "assistant", content: `**Fehler:** ${(e as Error).message}` }]);
    } finally { setSending(false); }
  }

  function applyEdit() {
    if (!pendingEdit) return;
    const st = useChatStore.getState();
    const prev = pendingEdit.kind === "concept" ? st.activeConcept : st.activeRoadmap;
    if (pendingEdit.kind === "concept") st.setActiveConcept(pendingEdit.updated as ConceptData);
    else st.setActiveRoadmap(pendingEdit.updated as RoadmapData);
    // Persist (skip while showing the tour example).
    if (token && scopeKey && !st.demoActive) {
      if (pendingEdit.kind === "concept") api.saveConcept(token, scopeKey, pendingEdit.updated as ConceptData).catch(() => {});
      else api.saveRoadmap(token, scopeKey, pendingEdit.updated as RoadmapData).catch(() => {});
    }
    setUndoData({ kind: pendingEdit.kind, prev });
    setPendingEdit(null);
  }

  function undoEdit() {
    if (!undoData) return;
    const st = useChatStore.getState();
    if (undoData.kind === "concept") st.setActiveConcept(undoData.prev as ConceptData | null);
    else st.setActiveRoadmap(undoData.prev as RoadmapData | null);
    if (token && scopeKey && !st.demoActive && undoData.prev) {
      if (undoData.kind === "concept") api.saveConcept(token, scopeKey, undoData.prev as ConceptData).catch(() => {});
      else api.saveRoadmap(token, scopeKey, undoData.prev as RoadmapData).catch(() => {});
    }
    setUndoData(null);
  }

  return (
    <div data-tour="assistant" className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 shrink-0 border-b border-zinc-100 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-green-50 dark:bg-green-950/60 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-green-600" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 flex-1">Persönlicher Assistent</p>
        </div>
      </div>

      {/* Edit-mode banner */}
      {editContext && (
        <div className="flex items-center gap-2 px-4 py-2 shrink-0 bg-green-50 dark:bg-green-950/40 border-b border-green-100 dark:border-green-900">
          <Pencil className="w-3.5 h-3.5 text-green-600 shrink-0" strokeWidth={1.5} />
          <p className="text-[11px] text-green-800 dark:text-green-300 flex-1 min-w-0">
            Bearbeiten: <span className="font-semibold">{editContext.target}</span>
          </p>
          <button onClick={() => { clearEdit(); setPendingEdit(null); }}
            className="text-[11px] font-medium text-green-700 dark:text-green-400 hover:underline shrink-0">
            Fertig
          </button>
        </div>
      )}

      {/* Conversation (or intro + capabilities when empty) */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && !sending && editContext ? (
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Sag mir, was du an <span className="font-semibold text-zinc-700 dark:text-zinc-200">{editContext.target}</span> ändern
            möchtest — oder frag mich, was am besten zu dir passt. Ich schlage die Änderung vor, du übernimmst sie mit einem Klick.
          </p>
        ) : messages.length === 0 && !sending ? (
          <div>
            {/* Coach agent identity — numbered & renameable ("Hire an Agent") */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-lg bg-green-600 text-white text-[10px] font-bold flex items-center justify-center" style={{ fontFamily: "Georgia, serif" }}>C</span>
                <span className="text-[9.5px] font-semibold uppercase tracking-widest text-green-600">AI Agent</span>
                {renamingCoach ? (
                  <input
                    autoFocus
                    value={coachDraft}
                    onChange={e => setCoachDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveCoachName(); if (e.key === "Escape") setRenamingCoach(false); }}
                    onBlur={saveCoachName}
                    maxLength={24}
                    className="w-28 bg-transparent border-b border-green-400 text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                ) : (
                  <button onClick={() => { setCoachDraft(coachName); setRenamingCoach(true); }}
                    className="group/rn inline-flex items-center gap-1.5 text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">
                    {coachName}
                    <Pencil className="w-3 h-3 text-zinc-400 group-hover/rn:text-green-600 transition-colors" strokeWidth={1.7} />
                  </button>
                )}
              </div>
              <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                Hey{displayName ? ` ${displayName}` : ""}, ich begleite dich bei jedem Schritt und behalte den Überblick — jederzeit ansprechbar, ohne deinen Hauptchat zu unterbrechen.
              </p>
            </div>

            {/* First-run greeting — the assistant speaks up ("plopp") */}
            <AnimatePresence>
              {greeting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="mb-5"
                >
                  <div className="help-md text-[12px] leading-relaxed rounded-xl px-3 py-2.5 bg-green-50 dark:bg-green-950/40 text-zinc-700 dark:text-zinc-200 border border-green-200 dark:border-green-900">
                    Kennst du die Anwendung schon, oder soll ich dir schnell alles zeigen?
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button onClick={acceptTour}
                      className="px-2.5 py-1 rounded-full bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold transition-colors duration-150">
                      Ja, zeig&apos;s mir
                    </button>
                    <button onClick={dismissGreeting}
                      className="px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150">
                      Kenn ich schon
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <ul className="space-y-2.5 mb-5">
              {CAPABILITIES.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-[12.5px] text-zinc-600 dark:text-zinc-300 leading-snug">
                  <Icon className="w-4 h-4 text-green-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                  {text}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Frag mich jederzeit etwas — ich antworte hier, ohne deinen Hauptchat zu unterbrechen.
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === "user";
            let text = toText(m.content);
            if (!text.trim()) return null;
            let choices: string[] = [];
            const cm = text.match(/\[\[CHOICES:\s*([\s\S]*?)\]\]/i);
            if (cm) { choices = cm[1].split("|").map(s => s.trim()).filter(Boolean); text = text.replace(cm[0], "").trim(); }
            const isLast = i === messages.length - 1;
            return (
              <div key={i}>
                {isUser ? (
                  <div className="text-[12px] leading-relaxed whitespace-pre-wrap rounded-xl px-3 py-2 bg-green-600 text-white ml-6">
                    {text}
                  </div>
                ) : (
                  <div
                    className="help-md text-[12px] leading-relaxed rounded-xl px-3 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 mr-2 border border-zinc-100 dark:border-zinc-700 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: md(text) }}
                  />
                )}
                {!isUser && isLast && choices.length > 0 && !sending && (
                  <div className="flex flex-wrap gap-1.5 mt-2 mr-2">
                    {choices.map(c => (
                      <button key={c} onClick={() => send(c)}
                        className="px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800 bg-white dark:bg-zinc-900 text-[11px] text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 hover:border-green-400 transition-colors duration-150">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        {sending && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Agent denkt nach…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Proposed edit — apply or discard */}
      {pendingEdit && (
        <div className="px-3 pb-2 shrink-0">
          <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 p-3">
            <p className="text-[12px] font-medium text-green-800 dark:text-green-300 mb-2">Änderung übernehmen?</p>
            <div className="flex items-center gap-2">
              <button onClick={applyEdit}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 transition-colors">
                <Check className="w-3.5 h-3.5" strokeWidth={2} /> Übernehmen
              </button>
              <button onClick={() => setPendingEdit(null)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-1.5">
                Verwerfen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo the last applied edit */}
      {undoData && !pendingEdit && (
        <div className="px-3 pb-2 shrink-0">
          <button onClick={undoEdit}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Änderung rückgängig machen
          </button>
        </div>
      )}

      {/* Composer — always available */}
      <div className="px-3 pb-3 pt-1 shrink-0">
        <div className="focus-parent flex gap-2 items-end bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus-within:border-green-400 dark:focus-within:border-green-600 transition-colors">
          <textarea value={input} rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={editContext ? "Was soll sich ändern? Oder frag nach…" : "Ask anything… (Enter to send)"}
            className="flex-1 bg-transparent border-none resize-none text-xs text-zinc-900 dark:text-zinc-100 outline-none leading-relaxed placeholder:text-zinc-400 min-w-0"
            style={{ minHeight: 20, maxHeight: 100 }} />
          <button onClick={() => send(input)} disabled={!input.trim() || sending}
            className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              input.trim() && !sending
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-zinc-100 dark:bg-zinc-700 text-zinc-400 cursor-default")}>
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel shell: persistent column on desktop, slide-in drawer on mobile ──────

const MIN_W = 240;
const MAX_W = 640;
const DEFAULT_W = 280; // SSR-safe fallback before we can measure window width

export function AssistantDock({ token, projectId, scopeKey }: { token: string | null; projectId: string | null; scopeKey: string }) {
  const openMobile = useChatStore(s => s.assistantOpenMobile);
  const setOpenMobile = useChatStore(s => s.setAssistantOpenMobile);

  const [width, setWidth] = useState(DEFAULT_W);
  const widthRef = useRef(DEFAULT_W);
  const dragging = useRef(false);

  const apply = (w: number) => { widthRef.current = w; setWidth(w); };

  useEffect(() => {
    const saved = Number(localStorage.getItem("matfit_assistant_w"));
    if (saved >= MIN_W && saved <= MAX_W) { apply(saved); return; }
    // No saved preference yet — default to roughly a third of the screen.
    apply(Math.min(MAX_W, Math.max(MIN_W, Math.round(window.innerWidth / 3))));
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      // Panel sits on the right edge — width grows as the cursor moves left.
      apply(Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX)));
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("matfit_assistant_w", String(widthRef.current));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <>
      {/* Desktop: always-present, resizable column */}
      <aside className="no-print relative hidden lg:flex flex-col shrink-0 border-l border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-full"
        style={{ width }}>
        {/* Drag handle on the left edge */}
        <div onMouseDown={startDrag}
          title="Ziehen zum Anpassen"
          className="group absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize z-20 flex items-center justify-center">
          <div className="h-12 w-1 rounded-full bg-zinc-200 dark:bg-zinc-700 group-hover:bg-green-500 transition-colors duration-150" />
        </div>
        <AssistantPanel token={token} projectId={projectId} scopeKey={scopeKey} />
      </aside>

      {/* Mobile: slide-in drawer (opened from the topbar assistant button) */}
      <AnimatePresence>
        {openMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="lg:hidden fixed inset-0 bg-black/40 z-40"
              onClick={() => setOpenMobile(false)}
            />
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: "transform" }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-[86%] max-w-[360px] bg-white dark:bg-zinc-900 border-l border-zinc-100 dark:border-zinc-800 flex flex-col shadow-2xl shadow-black/30"
            >
              <div className="flex items-center justify-end px-2 py-2 shrink-0">
                <button onClick={() => setOpenMobile(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <AssistantPanel token={token} projectId={projectId} scopeKey={scopeKey} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Re-exported for callers that still reference the context type.
export type { AssistantContext };
