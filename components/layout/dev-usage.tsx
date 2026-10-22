"use client";

import { useCallback, useEffect, useState } from "react";
import { loadTeamUsage, type TeamUsage } from "@/lib/team-usage";
import { IconRefresh } from "@/components/layout/agxp-icons";

const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en")}`;
const tokens = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

/**
 * Settings → Plan, team only: what every account has cost this month.
 *
 * Asked for on 2026-10-16 so the beta testers' use can be watched before the
 * free and paid limits are fixed from real numbers rather than guesses.
 *
 * The data comes through team_usage(), which refuses anyone off the team;
 * the check that draws this panel is only the courtesy in front of it.
 */
export function DevUsage() {
  const [usage, setUsage] = useState<TeamUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try { setUsage(await loadTeamUsage()); }
    catch (e) { setError((e as Error).message || "Couldn't read that."); }
    finally { setBusy(false); }
  }, []);

  // Not through refresh(): that flips `busy` synchronously, which React 19
  // warns about inside an effect (the same note as in dev-memory.tsx).
  useEffect(() => {
    let alive = true;
    loadTeamUsage()
      .then(u => { if (alive) setUsage(u); })
      .catch(e => { if (alive) setError((e as Error).message || "Couldn't read that."); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="ss-field ss-dev">
      <span className="ss-label">
        Usage this month <em>team only</em>
        <button className="ss-mem-reload" onClick={refresh} disabled={busy}
          data-tooltip="Read again" aria-label="Read again">
          <IconRefresh size={12} />
        </button>
      </span>

      {!usage && !error && <span className="ss-hint">Reading usage…</span>}

      {usage && (
        <>
          <div className="ss-use-total">
            <div className="ss-use-top">
              <b>{usd(usage.totalUsd)}</b>
              <span>{usage.totalRequests} requests · {tokens(usage.totalTokens)} tokens</span>
            </div>
            <span className="ss-hint">Estimated from the token counts the API reported.</span>
          </div>

          {usage.users.length > 0 ? (
            <table className="ss-use-table">
              <thead>
                <tr><th scope="col">Account</th><th scope="col">Plan</th><th scope="col">Requests</th><th scope="col">Tokens</th><th scope="col">Cost</th></tr>
              </thead>
              <tbody>
                {usage.users.map(u => (
                  <tr key={u.userId}>
                    <th scope="row" title={u.email}>{u.email}</th>
                    <td>{u.plan ?? "–"}</td>
                    <td>{u.requests}</td>
                    <td>{tokens(u.tokens)}</td>
                    <td>{usd(u.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="ss-hint">Nothing spent yet this month.</span>
          )}
        </>
      )}

      {error && <p className="ss-dev-error" role="alert">{error}</p>}
    </div>
  );
}
