"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "motion/react";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { Search, Plus, Folder, Zap, Map, Settings, Sun, Moon, CornerDownLeft } from "lucide-react";

/**
 * Command palette (⌘K / Ctrl+K) — quick navigation and actions, the way every
 * enterprise tool expects. Opens on the shortcut or via the topbar search button
 * (which dispatches a `matfit:cmdk` window event).
 */
interface Cmd { id: string; label: string; hint?: string; Icon: React.ElementType; keywords: string; run: () => void; }

export function CommandPalette({ onOpenSettings }: { onOpenSettings: () => void }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const store = useChatStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === "dark";

  const cmds: Cmd[] = useMemo(() => [
    { id: "new", label: "Neues Projekt", hint: "Geführtes Interview", Icon: Plus, keywords: "neu projekt start interview konzept",
      run: () => { store.newChat(); store.setActiveProject(null); router.push("/chat"); } },
    { id: "projects", label: "Projekte", hint: "Konversationen wechseln", Icon: Folder, keywords: "projekte konversationen chats",
      run: () => router.push("/chat") },
    { id: "concept", label: "Transformation Concept", hint: "Ist → Ziel", Icon: Zap, keywords: "konzept transformation ist ziel tooling",
      run: () => router.push(`/concept?session=${store.sessionId}`) },
    { id: "roadmap", label: "Roadmap", hint: "Phasen & Plan", Icon: Map, keywords: "roadmap dashboard phasen plan",
      run: () => router.push(`/dashboard?session=${store.sessionId}`) },
    { id: "settings", label: "Einstellungen", hint: "Profil & Darstellung", Icon: Settings, keywords: "einstellungen settings profil design assistent",
      run: onOpenSettings },
    { id: "theme", label: isDark ? "Helles Design" : "Dunkles Design", hint: "Umschalten", Icon: isDark ? Sun : Moon, keywords: "design theme hell dunkel dark light",
      run: () => setTheme(isDark ? "light" : "dark") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isDark, store.sessionId]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return cmds;
    return cmds.filter(c => (c.label + " " + c.keywords).toLowerCase().includes(s));
  }, [q, cmds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    }
    function onOpenEvt() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("matfit:cmdk", onOpenEvt);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("matfit:cmdk", onOpenEvt); };
  }, []);

  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => { setI(0); }, [q]);

  function exec(c: Cmd) { setOpen(false); c.run(); }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setI(v => Math.min(v + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(v => Math.max(v - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[i]) exec(results[i]); }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh] px-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: "spring", duration: 0.28, bounce: 0.06 }}
              onKeyDown={onListKey}
              className="pointer-events-auto w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/30 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center gap-3 px-4 h-13 border-b border-zinc-100 dark:border-zinc-800 py-3">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.6} />
                <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Suchen oder Aktion wählen…"
                  className="flex-1 bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400" />
                <span className="kbd">ESC</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto p-2">
                {results.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-8">Keine Treffer für „{q}“.</p>
                ) : results.map((c, idx) => (
                  <button key={c.id} onMouseEnter={() => setI(idx)} onClick={() => exec(c)}
                    className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                      idx === i ? "bg-green-50 dark:bg-green-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")}>
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      idx === i ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400")}>
                      <c.Icon className="w-4 h-4" strokeWidth={1.6} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.label}</span>
                      {c.hint && <span className="block text-[11px] text-zinc-400">{c.hint}</span>}
                    </span>
                    {idx === i && <CornerDownLeft className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.6} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
