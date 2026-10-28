"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadTeamFeedback, loadFeedbackConversation, rateFeedback, type FeedbackRow } from "@/lib/team-feedback";
import { SEVERITIES, SEVERITY_LABEL, type Severity } from "@/lib/feedback-triage";
import { IconRefresh } from "@/components/layout/agxp-icons";

type Filter = "all" | Severity | "unrated";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * The team's feedback dashboard, at /dashboard/feedback.
 *
 * Everything testers sent through the Feedback tab, most serious first. The
 * seriousness is the model's rating of the message (app/api/feedback/triage),
 * never the tester's own box — that box only sends the email, and shows here as
 * "Flagged by tester". A row that was never rated says so and can be rated from
 * here; until then it sits after the rated ones (a flagged one among the high ones).
 *
 * The rows come through team_feedback(), which refuses anyone off the team; the
 * page's own check is only the courtesy in front of it.
 */
export function FeedbackDashboard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [chats, setChats] = useState<Record<string, string | "loading" | "error">>({});

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try { setRows(await loadTeamFeedback()); }
    catch (e) { setError((e as Error).message || "Couldn't read that."); }
    finally { setBusy(false); }
  }, []);

  // Not through refresh(): that flips `busy` synchronously, which React 19
  // warns about inside an effect (the same note as in dev-usage.tsx).
  useEffect(() => {
    let alive = true;
    loadTeamFeedback()
      .then(r => { if (alive) setRows(r); })
      .catch(e => { if (alive) setError((e as Error).message || "Couldn't read that."); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, critical: 0, high: 0, medium: 0, low: 0, unrated: 0 };
    for (const r of rows ?? []) { c.all++; c[r.severity ?? "unrated"]++; }
    return c;
  }, [rows]);

  const shown = (rows ?? []).filter(r => filter === "all" || (r.severity ?? "unrated") === filter);
  const unrated = (rows ?? []).filter(r => !r.severity);

  /** One at a time: a rating is a model call, and the order is the page's order. */
  async function rate(ids: string[]) {
    setRating(new Set(ids));
    for (const id of ids) {
      await rateFeedback(id);
      setRating(s => { const n = new Set(s); n.delete(id); return n; });
    }
    await refresh();
  }

  async function toggleChat(id: string) {
    if (chats[id] && chats[id] !== "error") { setChats(c => { const n = { ...c }; delete n[id]; return n; }); return; }
    setChats(c => ({ ...c, [id]: "loading" }));
    try {
      const text = await loadFeedbackConversation(id);
      setChats(c => ({ ...c, [id]: text || "(empty)" }));
    } catch {
      setChats(c => ({ ...c, [id]: "error" }));
    }
  }

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    ...SEVERITIES.map(s => ({ key: s as Filter, label: SEVERITY_LABEL[s] })),
    { key: "unrated", label: "Not rated" },
  ];

  return (
    <div className="fbd">
      <header className="fbd-head">
        <div>
          <h1>Feedback</h1>
          <p>What testers sent, most serious first. The seriousness is rated by AI from the message.</p>
        </div>
        <button className="icon-btn" onClick={refresh} disabled={busy} data-tooltip="Read again" aria-label="Read again">
          <IconRefresh size={15} />
        </button>
      </header>

      {error && <p className="ss-error" role="alert">{error}</p>}
      {!rows && !error && <p className="fbd-note">Reading feedback…</p>}

      {rows && (
        <>
          <div className="fbd-chips" role="group" aria-label="Filter by seriousness">
            {chips.filter(c => c.key === "all" || counts[c.key] > 0 || c.key === filter).map(c => (
              <button key={c.key} className={`fbd-chip${c.key !== "all" && c.key !== "unrated" ? ` sev-${c.key}` : ""}`}
                aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}>
                {c.label}<b>{counts[c.key]}</b>
              </button>
            ))}
            {unrated.length > 0 && (
              <button className="fbd-rate-all" disabled={rating.size > 0} onClick={() => rate(unrated.map(r => r.id))}>
                {rating.size > 0 ? "Rating…" : `Rate ${unrated.length} not rated`}
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="fbd-note">{rows.length === 0 ? "No feedback yet." : "Nothing here."}</p>
          ) : (
            <ul className="fbd-list">
              {shown.map(r => {
                const chat = chats[r.id];
                const open = !!chat && chat !== "error" && chat !== "loading";
                return (
                  <li key={r.id} className={r.severity ? `sev-${r.severity}` : "sev-none"}>
                    <div className="fbd-top">
                      <span className={`fbd-sev${r.severity ? ` sev-${r.severity}` : ""}`}>
                        {r.severity ? SEVERITY_LABEL[r.severity] : "Not rated"}
                      </span>
                      <span className="fbd-who">{r.email}</span>
                      <span className="fbd-when">{when(r.createdAt)}</span>
                    </div>
                    <p className="fbd-msg">{r.message}</p>
                    {r.severityReason && <p className="fbd-why">{r.severityReason}</p>}
                    <div className="fbd-tags">
                      {r.serious && <span className="fbd-tag">Flagged by tester</span>}
                      {r.serious && !r.notifiedAt && <span className="fbd-tag bad">Email not sent</span>}
                      {r.page && <span className="fbd-tag">{r.page}</span>}
                      {!r.severity && (
                        <button className="fbd-link" disabled={rating.has(r.id)} onClick={() => rate([r.id])}>
                          {rating.has(r.id) ? "Rating…" : "Rate now"}
                        </button>
                      )}
                      {r.includeConversation && (
                        <button className="fbd-link" onClick={() => toggleChat(r.id)} aria-expanded={open}>
                          {open ? "Hide conversation" : `Conversation · ${Math.max(1, Math.round(r.conversationChars / 1000))}k characters`}
                        </button>
                      )}
                    </div>
                    {chat === "loading" && <span className="fbd-note">Reading the conversation…</span>}
                    {chat === "error" && <span className="ss-error" role="alert">Couldn&apos;t read the conversation.</span>}
                    {open && <pre className="fbd-pre">{chat}</pre>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
