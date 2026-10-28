"use client";

import { useCallback, useEffect, useState } from "react";
import { loadTeamFeedback, loadFeedbackConversation, type FeedbackRow } from "@/lib/team-feedback";
import { IconRefresh } from "@/components/layout/agxp-icons";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Settings → Plan, team only: everything testers sent through the Feedback tab.
 *
 * Serious problems first in the count and flagged; a serious one whose email
 * never went out says so, because that is the one case where the team would
 * otherwise not know. The conversation, when the tester shared it, is read on
 * request, not with the list.
 *
 * The data comes through team_feedback(), which refuses anyone off the team;
 * the check that draws this panel is only the courtesy in front of it.
 */
export function DevFeedback() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlySerious, setOnlySerious] = useState(false);
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

  async function showChat(id: string) {
    if (chats[id] && chats[id] !== "error") { setChats(c => { const n = { ...c }; delete n[id]; return n; }); return; }
    setChats(c => ({ ...c, [id]: "loading" }));
    try {
      const text = await loadFeedbackConversation(id);
      setChats(c => ({ ...c, [id]: text || "(empty)" }));
    } catch {
      setChats(c => ({ ...c, [id]: "error" }));
    }
  }

  const serious = rows?.filter(r => r.serious).length ?? 0;
  const shown = rows?.filter(r => !onlySerious || r.serious) ?? [];

  return (
    <div className="ss-field ss-dev">
      <span className="ss-label">
        Feedback <em>team only</em>
        <button className="ss-mem-reload" onClick={refresh} disabled={busy}
          data-tooltip="Read again" aria-label="Read again">
          <IconRefresh size={12} />
        </button>
      </span>

      {!rows && !error && <span className="ss-hint">Reading feedback…</span>}

      {rows && (
        <>
          <div className="fbp-top">
            <span><b>{rows.length}</b> in all · <b className={serious ? "fbp-bad" : undefined}>{serious}</b> serious</span>
            <label className="fbp-filter">
              <input type="checkbox" checked={onlySerious} onChange={e => setOnlySerious(e.target.checked)} />
              Only serious
            </label>
          </div>

          {shown.length === 0 ? (
            <span className="ss-hint">{rows.length === 0 ? "Nothing yet." : "No serious problems."}</span>
          ) : (
            <ul className="fbp-list">
              {shown.map(r => {
                const chat = chats[r.id];
                return (
                  <li key={r.id} className={r.serious ? "is-serious" : undefined}>
                    <div className="fbp-meta">
                      <span>{r.email}</span>
                      <span>{when(r.createdAt)}</span>
                    </div>
                    <p className="fbp-msg">{r.message}</p>
                    <div className="fbp-tags">
                      {r.serious && <span className="fbp-tag bad">Serious</span>}
                      {r.serious && !r.notifiedAt && <span className="fbp-tag bad">Email not sent</span>}
                      {r.page && <span className="fbp-tag">{r.page}</span>}
                      {r.includeConversation && (
                        <button className="fbp-chat" onClick={() => showChat(r.id)} aria-expanded={!!chat && chat !== "error"}>
                          {chat && chat !== "error" && chat !== "loading" ? "Hide conversation" : `Conversation · ${Math.round(r.conversationChars / 1000)}k characters`}
                        </button>
                      )}
                    </div>
                    {chat === "loading" && <span className="ss-hint">Reading the conversation…</span>}
                    {chat === "error" && <span className="ss-error" role="alert">Couldn&apos;t read the conversation.</span>}
                    {chat && chat !== "loading" && chat !== "error" && <pre className="fbp-pre">{chat}</pre>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {error && <span className="ss-error" role="alert">{error}</span>}
    </div>
  );
}
