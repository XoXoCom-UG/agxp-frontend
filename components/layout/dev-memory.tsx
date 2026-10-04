"use client";

import { useCallback, useEffect, useState } from "react";
import { loadMemoryAudit, rate, type MemoryAudit } from "@/lib/memory-audit";
import { IconRefresh, IconSpark } from "@/components/layout/agxp-icons";

/**
 * Settings → Plan, team only: proof that the agents are still learning.
 *
 * The number that matters is the first one — the share of replies carrying a
 * [[MEMORY:]] marker. It is normal for it to be low; a marker belongs on a
 * reply that learned something, not on every turn. What is not normal is
 * zero, or a rate that collapses after a prompt change. That is the whole
 * reason this is on screen instead of in a query someone has to remember to
 * run.
 *
 * It reads the signed-in account's own rows and nothing else — so unlike the
 * panel above it, hiding this one is about keeping Settings uncluttered for
 * a tester, not about protecting anything. The team check that draws it is
 * the grant plus the company domain (migration 0012).
 */
export function DevMemory() {
  const [audit, setAudit] = useState<MemoryAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try { setAudit(await loadMemoryAudit()); }
    catch (e) { setError((e as Error).message || "Couldn't read that."); }
    finally { setBusy(false); }
  }, []);

  // The first read does not go through refresh(): that one flips `busy`
  // synchronously, and setting state in the body of an effect is what React 19
  // warns about. `alive` is here because Settings can be closed mid-read.
  useEffect(() => {
    let alive = true;
    loadMemoryAudit()
      .then(a => { if (alive) setAudit(a); })
      .catch(e => { if (alive) setError((e as Error).message || "Couldn't read that."); });
    return () => { alive = false; };
  }, []);

  const pct = audit ? rate(audit.withMemory, audit.replies) : 0;
  const quiet = !!audit && audit.replies > 20 && audit.withMemory === 0;

  return (
    <div className="ss-field ss-dev">
      <span className="ss-label">
        Agent memory <em>team only</em>
        <button className="ss-mem-reload" onClick={refresh} disabled={busy}
          data-tooltip="Read again" aria-label="Read again">
          <IconRefresh size={12} />
        </button>
      </span>

      {!audit && !error && <span className="ss-hint">Reading your projects…</span>}

      {audit && (
        <>
          <div className="ss-mem-top">
            <div className="ss-mem-rate" data-quiet={quiet || undefined}>
              <b>{pct}%</b>
              <span>of {audit.replies} replies taught the agent something</span>
            </div>
            <ul className="ss-mem-split">
              {(["consultant", "coach"] as const).map(r => (
                <li key={r}>
                  <span className="k">{r === "coach" ? "Coach" : "Consultant"}</span>
                  <span className="v">{audit.byRole[r].marked} / {audit.byRole[r].replies}</span>
                </li>
              ))}
            </ul>
          </div>

          {quiet && (
            <p className="ss-mem-warn" role="status">
              Nothing has been learned across {audit.replies} replies. The marker instruction
              is in the system prompt — if that number stays at zero after a prompt change,
              the change is what stopped it.
            </p>
          )}

          {audit.lessons.length > 0 && (
            <details className="ss-mem-list">
              <summary>{audit.lessons.length} lessons across {audit.projects} projects</summary>
              <ul>
                {audit.lessons.map((l, i) => (
                  <li key={`${l.fact}-${i}`}>
                    <IconSpark size={11} />
                    <div>
                      <p>{l.fact}</p>
                      <span>{l.kind} · {l.role === "coach" ? "Coach" : "Consultant"} · {l.project}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {audit.lessons.length === 0 && !quiet && (
            <span className="ss-hint">
              No lessons yet. Finish a project and the agent writes down what it would do
              differently next time.
            </span>
          )}
        </>
      )}

      {error && <p className="ss-dev-error" role="alert">{error}</p>}
    </div>
  );
}
