"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { PLANS, type PlanId } from "@/lib/plans";
import { IconCopy, IconCheck, IconPlus, IconAlert } from "@/components/layout/agxp-icons";

/**
 * The team's own controls, inside Settings → Plan.
 *
 * Switching your own plan is the only way to actually look at what a tier
 * gives you without editing the database between every check. It is also the
 * one thing that must never reach a tester: a plan the user can set is not a
 * plan. So this whole panel is drawn only when `can_switch_plan` is true on
 * the account, and — the part that matters — every action it fires is
 * checked again inside the database function. Hiding the buttons is a
 * courtesy; the refusal is the security.
 */

interface ConfigFinding {
  key: string;
  level: "fatal" | "silent" | "optional";
  consequence: string;
}

interface BetaKey {
  code: string;
  plan: string;
  used_count: number;
  max_uses: number;
  note: string | null;
}

async function call(method: "GET" | "POST", body?: unknown) {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session has expired. Sign in again.");
  const res = await fetch("/api/dev", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "That didn't work.");
  return json;
}

export function DevPlanTools({ current, onChanged }: { current: PlanId; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<BetaKey[] | null>(null);
  const [config, setConfig] = useState<ConfigFinding[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    call("GET")
      .then(r => {
        if (!alive) return;
        setKeys(r.keys as BetaKey[]);
        setConfig((r.config as ConfigFinding[]) ?? []);
      })
      .catch(() => { if (alive) setKeys([]); });
    return () => { alive = false; };
  }, []);

  async function switchPlan(plan: PlanId) {
    if (busy || plan === current) return;
    setBusy(plan); setError(null);
    try {
      await call("POST", { action: "plan", plan });
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function mint() {
    if (busy) return;
    setBusy("key"); setError(null);
    try {
      const r = await call("POST", { action: "key", plan: "max", uses: 1, note: note.trim() });
      setNote("");
      setKeys(k => [{ code: r.code, plan: "max", used_count: 0, max_uses: 1, note: note.trim() || null }, ...(k ?? [])]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(c => (c === code ? null : c)), 1600);
    } catch { /* clipboard blocked — the code is on screen to read */ }
  }

  return (
    <>
      {config.length > 0 && (
        <div className="ss-field ss-dev ss-conf">
          <span className="ss-label">Server configuration <em>team only</em></span>
          <ul className="ss-conf-list">
            {config.map(c => (
              <li key={c.key} data-level={c.level}>
                <IconAlert size={12} />
                <div>
                  <code>{c.key}</code>
                  <p>{c.consequence}</p>
                </div>
              </li>
            ))}
          </ul>
          <span className="ss-hint">
            Set these where the server runs — <code>.env.local</code> here, project settings on
            Vercel — then restart. A <b>silent</b> one costs you nothing visible, which is
            exactly why it is listed.
          </span>
        </div>
      )}

      <div className="ss-field ss-dev">
        <span className="ss-label">Switch plan <em>team only</em></span>
        <div className="ss-segment" role="group" aria-label="Plan">
          {(Object.keys(PLANS) as PlanId[]).map(id => (
            <button key={id} className={current === id ? "on" : ""} aria-pressed={current === id}
              disabled={!!busy} onClick={() => switchPlan(id)}>
              {busy === id ? "…" : PLANS[id].label}
            </button>
          ))}
        </div>
        <span className="ss-hint">
          Only accounts with the team flag can do this, and the database checks it again on
          every switch — the buttons being hidden is not what stops anyone else.
        </span>
      </div>

      <div className="ss-field ss-dev">
        <span className="ss-label">Invitations <em>team only</em></span>
        <div className="ss-keymint">
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Who is this for?" aria-label="Who the key is for" />
          <button className="btn btn-hero btn-sm" disabled={!!busy} onClick={mint}>
            <IconPlus size={12} />{busy === "key" ? "…" : "New key"}
          </button>
        </div>

        {keys === null && <span className="ss-hint">Loading…</span>}
        {keys !== null && keys.length === 0 && (
          <span className="ss-hint">No invitations yet. Make one and send the code — that is all a tester needs.</span>
        )}
        {keys !== null && keys.length > 0 && (
          <ul className="ss-keys">
            {keys.map(k => {
              const spent = k.used_count >= k.max_uses;
              return (
                <li key={k.code} className={spent ? "spent" : undefined}>
                  <button className="ss-key-code" onClick={() => copy(k.code)}
                    data-tooltip={spent ? "Already used" : "Copy"}>
                    <code>{k.code}</code>
                    {copied === k.code ? <IconCheck size={12} /> : <IconCopy size={12} />}
                  </button>
                  <span className="ss-key-meta">
                    {k.plan} · {k.used_count}/{k.max_uses}
                    {k.note ? ` · ${k.note}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <p className="ss-dev-error" role="alert">{error}</p>}
    </>
  );
}
