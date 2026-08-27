"use client";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { X, User, Palette, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useChatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

type Tab = "profil" | "darstellung";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profil");
  const { theme, setTheme } = useTheme();
  const { user, signOut, token, profileName, setProfileName } = useAuth();
  const startTour = useChatStore(s => s.startTour);
  const persona = useChatStore(s => s.persona);
  const setPersona = useChatStore(s => s.setPersona);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      // Hard navigation clears all in-memory state (chat store, caches)
      window.location.href = "/login";
    }
  }

  useEffect(() => {
    if (open) setName(profileName);
  }, [open, profileName]);

  async function saveName() {
    const n = name.trim();
    setSaveError(false);
    // Persist to the backend profile — the single source of truth, scoped to
    // this account via the token. Read-merge-write: the save endpoint
    // overwrites every field, so sending only {name} would wipe what the
    // agent has learned about the user.
    if (token) {
      try {
        const current = await api.getProfile(token).catch(() => ({} as Record<string, string>));
        // Write both name fields — the backend's canonical "display name"
        // field isn't fully pinned down, so cover both to avoid silently
        // saving to a field nothing reads back from.
        await api.saveProfile(token, { ...current, name: n, display_name: n });
        setProfileName(n);
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      } catch { setSaveError(true); }
    }
  }

  const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "profil",       label: "Profil",       Icon: User    },
    { id: "darstellung",  label: "Darstellung",  Icon: Palette },
  ];

  const THEMES = [
    { value: "light",  label: "Hell",    Icon: Sun     },
    { value: "dark",   label: "Dunkel",  Icon: Moon    },
    { value: "system", label: "Auto",    Icon: Monitor },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              transition={{ type: "spring", duration: 0.38, bounce: 0.08 }}
              className="pointer-events-auto w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/30 border border-zinc-200 dark:border-zinc-800 overflow-hidden flex"
              style={{ maxWidth: 680, height: 460 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Left nav */}
              <div className="w-48 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col p-3 shrink-0">
                {/* Brand */}
                <div className="flex items-center gap-px px-2 py-3 mb-4">
                  <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">matfit</span>
                  <span className="font-bold text-lg tracking-tight text-green-600">.ai</span>
                </div>

                {TABS.map(t => (
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 font-medium text-left transition-colors duration-150",
                      tab === t.id
                        ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-sm border border-zinc-100 dark:border-zinc-800"
                        : "text-zinc-500 dark:text-zinc-400 hover:bg-white/70 dark:hover:bg-zinc-900/60 hover:text-zinc-700 dark:hover:text-zinc-200"
                    )}
                  >
                    <t.Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                    {t.label}
                  </motion.button>
                ))}

                {/* Legal links */}
                <div className="mt-auto pt-3 flex flex-col gap-1 px-2">
                  {[["Impressum", "/impressum"], ["Datenschutz", "/datenschutz"], ["AGB", "/agb"]].map(([label, href]) => (
                    <a key={href} href={href} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                      {label}
                    </a>
                  ))}
                </div>
              </div>

              {/* Right content */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {tab === "profil" ? "Profil" : "Darstellung"}
                  </h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors duration-150"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </motion.button>
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {tab === "profil" && (
                      <motion.div
                        key="profil"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="p-6 space-y-5"
                      >
                        {/* Avatar preview */}
                        <div className="flex items-center gap-4 pb-5 border-b border-zinc-100 dark:border-zinc-800">
                          <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 flex items-center justify-center text-xl font-bold text-green-700 dark:text-green-400 shrink-0">
                            {name ? name[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? "U")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                              {name || user?.email?.split("@")[0] || "Kein Name"}
                            </p>
                            <p className="text-xs text-zinc-400">{user?.email}</p>
                            <p className="text-xs text-green-600 font-medium mt-0.5">IT Consultant · matfit.ai</p>
                          </div>
                        </div>

                        {/* Name field */}
                        <div>
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
                            Anzeigename
                          </label>
                          <div className="flex gap-2">
                            <input
                              value={name}
                              onChange={e => setName(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && saveName()}
                              placeholder="Dein Name"
                              className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all duration-150"
                            />
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={saveName}
                              className={cn(
                                "h-9 px-4 rounded-lg text-xs font-semibold transition-all duration-200 min-w-[90px]",
                                saved
                                  ? "bg-green-600 text-white"
                                  : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200"
                              )}
                            >
                              {saved ? "✓ Gespeichert" : "Speichern"}
                            </motion.button>
                          </div>
                          {saveError && (
                            <p className="text-[11px] text-red-600 mt-1.5">
                              Speichern fehlgeschlagen — bitte versuche es erneut.
                            </p>
                          )}
                        </div>

                        {/* Email (read-only) */}
                        <div>
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
                            E-Mail
                          </label>
                          <div className="h-9 rounded-lg border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 flex items-center">
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">{user?.email || "—"}</span>
                          </div>
                        </div>

                        {/* Assistant persona */}
                        <div data-tour="persona" className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
                            Assistenten-Stil
                          </label>
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 max-w-xs">
                            {([["berater", "Tier-1-Berater"], ["kritiker", "Kritiker-Modus"]] as const).map(([key, label]) => (
                              <button key={key} onClick={() => setPersona(key)}
                                className={cn("flex-1 text-xs font-medium rounded-md py-1.5 transition-colors",
                                  persona === key
                                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200")}>
                                {label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-2">
                            Tier-1-Berater gibt dir klare Empfehlungen, der Kritiker-Modus deckt Risiken und Schwächen auf.
                          </p>
                        </div>

                        {/* Tutorial */}
                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
                            Tour
                          </label>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { onClose(); setTimeout(() => startTour(), 200); }}
                            className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30 hover:bg-green-50 dark:hover:bg-green-950/60 transition-colors duration-150"
                          >
                            Tutorial wiederholen
                          </motion.button>
                          <p className="text-[11px] text-zinc-400 mt-2">
                            Zeigt dir die geführte Tour durch matfit.ai noch einmal.
                          </p>
                        </div>

                        {/* Logout */}
                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2 block">
                            Sitzung
                          </label>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleLogout}
                            disabled={loggingOut}
                            className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/60 hover:border-red-300 dark:hover:border-red-800 transition-colors duration-150 disabled:opacity-60"
                          >
                            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                            {loggingOut ? "Wird abgemeldet…" : "Abmelden"}
                          </motion.button>
                          <p className="text-[11px] text-zinc-400 mt-2">
                            Beendet deine Sitzung auf diesem Gerät.
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {tab === "darstellung" && (
                      <motion.div
                        key="darstellung"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="p-6"
                      >
                        <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-800">
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Design</p>
                            <p className="text-xs text-zinc-400 mt-0.5">Hell, dunkel oder Systemeinstellung</p>
                          </div>
                          <div className="flex gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
                            {THEMES.map(opt => (
                              <motion.button
                                key={opt.value}
                                whileTap={{ scale: 0.93 }}
                                onClick={() => setTheme(opt.value)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                                  theme === opt.value
                                    ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                )}
                              >
                                <opt.Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {opt.label}
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
