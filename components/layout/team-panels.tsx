"use client";

import { useState } from "react";
import Link from "next/link";
import type { TeamUsage } from "@/lib/team-usage";
import type { FeedbackRow } from "@/lib/team-feedback";
import { SEVERITIES, SEVERITY_LABEL, type Severity } from "@/lib/feedback-triage";
import { rate as ratio, type MemoryAudit } from "@/lib/memory-audit";
import { callDev, type AdminState, type BetaKey, type ConfigFinding } from "@/lib/team-admin";
import { PLANS, agentsLabel, projectsLabel, type PlanId } from "@/lib/plans";
import type { Loaded } from "@/lib/use-load";
import {
  IconAlert, IconArrow, IconCheck, IconCopy, IconMail, IconPlus, IconRefresh, IconSpark,
} from "@/components/layout/agxp-icons";

/**
 * The cards of the team dashboard (components/layout/team-dashboard.tsx).
 *
 * Everything here used to be six boxes stacked in Settings → Plan. Each is one
 * card now, with its own read and its own error: when one query fails the
 * others still draw. None of this protects anything — every number comes
 * through a function or route that asks is_team_member() first.
 */

export const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en")}`;
export const tokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

const initials = (email: string) => email.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";

const sentOn = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { day: "numeric", month: "short" });
};

/** A card: title, a line under it, something at the right, then the content. */
export function Card({ title, sub, action, tone, children }: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  tone?: "ok" | "warn" | "bad";
  children: React.ReactNode;
}) {
  return (
    <section className="td-card" data-tone={tone}>
      <header className="td-card-h">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="td-fail" role="alert">
      <IconAlert size={14} />
      <span>{message}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}><IconRefresh size={12} />Retry</button>
    </div>
  );
}

function Reading({ what }: { what: string }) {
  return <p className="td-reading" role="status"><span className="spinner" aria-hidden="true" />{what}</p>;
}

/* ------------------------------------------------------------------ Usage */

export function UsagePanel({ load }: { load: Loaded<TeamUsage> }) {
  const u = load.data;
  const top = u ? Math.max(0.0001, ...u.users.map(x => x.usd)) : 1;
  return (
    <Card title="Usage this month" sub="Estimated from the token counts the API reported.">
      {load.error && <Failed message={load.error} onRetry={load.reload} />}
      {!u && !load.error && <Reading what="Reading usage…" />}
      {u && (
        <>
          <div className="td-bignum">
            <b>{usd(u.totalUsd)}</b>
            <span>{u.totalRequests.toLocaleString("en")} requests · {tokens(u.totalTokens)} tokens · {u.users.length} {u.users.length === 1 ? "account" : "accounts"}</span>
          </div>
          {u.users.length === 0 ? (
            <p className="td-empty">Nothing spent yet this month.</p>
          ) : (
            <div className="td-scroll">
              <table className="td-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th><th scope="col">Plan</th>
                    <th scope="col" className="num">Requests</th><th scope="col" className="num">Tokens</th>
                    <th scope="col" className="num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {u.users.map(x => (
                    <tr key={x.userId}>
                      <th scope="row">
                        <span className="td-av" aria-hidden="true">{initials(x.email)}</span>
                        <span className="td-mail" title={x.email}>{x.email}</span>
                      </th>
                      <td><span className="td-pill">{x.plan ?? "–"}</span></td>
                      <td className="num">{x.requests.toLocaleString("en")}</td>
                      <td className="num">{tokens(x.tokens)}</td>
                      <td className="num td-cost">
                        <span>{usd(x.usd)}</span>
                        <i className="td-share" aria-hidden="true"><b style={{ width: `${Math.max(3, (x.usd / top) * 100)}%` }} /></i>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------- Server config */

const LEVEL_LABEL: Record<ConfigFinding["level"], string> = {
  fatal: "Breaks the app", silent: "Fails quietly", optional: "Optional",
};

/** The worst level among what is missing; null when nothing is. */
export function configTone(config: ConfigFinding[]): "bad" | "warn" | null {
  if (config.length === 0) return null;
  return config.some(c => c.level !== "optional") ? "bad" : "warn";
}

export function ConfigPanel({ load }: { load: Loaded<AdminState> }) {
  const config = load.data?.config ?? [];
  const tone = load.data ? configTone(config) : null;
  return (
    <Card title="Server configuration"
      sub={load.data ? (config.length ? `${config.length} not set` : "Everything is set") : undefined}
      tone={load.data ? (tone ?? "ok") : undefined}>
      {load.error && <Failed message={load.error} onRetry={load.reload} />}
      {!load.data && !load.error && <Reading what="Checking the server…" />}
      {load.data && config.length === 0 && (
        <p className="td-allgood"><IconCheck size={14} />Every environment variable the app looks for is in place.</p>
      )}
      {config.length > 0 && (
        <>
          <ul className="td-conf">
            {config.map(c => (
              <li key={c.key} data-level={c.level}>
                <IconAlert size={13} />
                <div>
                  <div className="td-conf-top">
                    <code>{c.key}</code>
                    <span className="td-pill" data-level={c.level}>{LEVEL_LABEL[c.level]}</span>
                  </div>
                  <p>{c.consequence}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="td-hint">
            Set these where the server runs — <code>.env.local</code> here, project settings on Vercel — then
            restart. A <b>silent</b> one costs you nothing visible, which is exactly why it is listed.
          </p>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- Switch plan */

export function PlanPanel({ current, onChanged }: { current: PlanId; onChanged: () => void }) {
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = PLANS[current];

  async function switchPlan(id: PlanId) {
    if (busy || id === current) return;
    setBusy(id); setError(null);
    try { await callDev("POST", { action: "plan", plan: id }); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <Card title="Switch plan" sub="Your own account only — to see what each tier gives.">
      <div className="td-seg" role="group" aria-label="Plan">
        {(Object.keys(PLANS) as PlanId[]).map(id => (
          <button key={id} type="button" className={current === id ? "on" : ""} aria-pressed={current === id}
            disabled={!!busy} onClick={() => switchPlan(id)}>
            {busy === id ? "…" : PLANS[id].label}
          </button>
        ))}
      </div>
      <p className="td-plan-now">
        <b>{p.label}</b> · {projectsLabel(p)} {p.projects >= 1000 ? "projects" : `projects per ${p.period}`} · {agentsLabel(p)}
      </p>
      <p className="td-hint">
        The database checks the team flag again on every switch — the buttons being hidden is not what stops anyone else.
      </p>
      {error && <p className="td-error" role="alert">{error}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------- Invitations */

export function keyCounts(keys: BetaKey[]) {
  const used = keys.filter(k => k.used_count >= k.max_uses).length;
  return { open: keys.length - used, used, total: keys.length };
}

export function InvitesPanel({ load }: { load: Loaded<AdminState> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<{ ok: boolean; text: string } | null>(null);
  /** The row whose address is being typed for a resend. */
  const [resending, setResending] = useState<{ code: string; to: string } | null>(null);

  const state = load.data;
  const keys = state?.keys ?? [];
  const mailReady = state ? state.mail : true;
  const counts = keyCounts(keys);

  function patch(update: (k: BetaKey[]) => BetaKey[]) {
    load.set(s => s ? { ...s, keys: update(s.keys) } : s);
  }

  async function mint() {
    if (busy) return;
    setBusy("key"); setError(null); setSentNote(null);
    const forNote = note.trim();
    const to = email.trim();
    try {
      const r = await callDev("POST", { action: "key", plan: "max", uses: 1, note: forNote, email: to });
      setNote(""); setEmail("");
      patch(k => [
        { code: r.code, plan: "max", used_count: 0, max_uses: 1, note: forNote || null,
          email: r.emailed ? to : null, emailed_at: r.emailed ? new Date().toISOString() : null },
        ...k,
      ]);
      // The key exists whatever the mail did, so this is a note beside it,
      // never an error that makes the key look like it failed.
      if (to) {
        if (!r.emailed) {
          setSentNote({ ok: false, text: `Key created, but not sent: ${r.emailError ?? "the email didn't go out."} Copy it below.` });
        } else if (r.emailError) {
          setSentNote({ ok: false, text: `Sent to ${to}. ${r.emailError}` });
        } else {
          // Naming which email went is the whole point: with a template
          // configured, "it arrived" does not tell you which one arrived.
          const which = r.via === "template"
            ? ` using the "${r.template}" template`
            : r.template ? " using the built-in email" : "";
          setSentNote({ ok: true, text: `Sent to ${to}${which}.` });
        }
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function resend(code: string, to: string) {
    const address = to.trim();
    if (busy || !address) return;
    setBusy(`resend:${code}`); setError(null); setSentNote(null);
    try {
      const r = await callDev("POST", { action: "resend", code, email: address });
      if (r.emailed) {
        patch(ks => ks.map(x => x.code === code ? { ...x, email: address, emailed_at: new Date().toISOString() } : x));
        setSentNote({ ok: true, text: `Sent ${code} to ${address}.` });
        setResending(null);
      } else {
        setSentNote({ ok: false, text: `Not sent: ${r.emailError ?? "the email didn't go out."}` });
      }
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
    <Card title="Invitations"
      sub={state ? `${counts.open} open · ${counts.used} used` : "Beta keys for testers"}>
      <div className="td-mint">
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="Who is this for?" aria-label="Who the key is for" />
        <input value={email} onChange={e => setEmail(e.target.value)}
          type="email" inputMode="email" autoComplete="off"
          placeholder={mailReady ? "Email it to… (optional)" : "Email isn't set up"}
          aria-label="Email the key to this address" disabled={!mailReady}
          onKeyDown={e => { if (e.key === "Enter" && !busy) mint(); }} />
        <button type="button" className="btn btn-hero btn-sm" disabled={!!busy || !state} onClick={mint}>
          <IconPlus size={12} />{busy === "key" ? "…" : email.trim() ? "Send key" : "New key"}
        </button>
      </div>

      {sentNote && <p className={`td-sent${sentNote.ok ? " is-ok" : ""}`} role="status">{sentNote.text}</p>}
      {state && mailReady && state.sandbox && (
        <p className="td-sent">
          Sending from Resend&apos;s test address, which only reaches the Resend account owner. Set{" "}
          <code>INVITE_FROM</code> to an address on a verified domain to reach anyone else.
        </p>
      )}
      {error && <p className="td-error" role="alert">{error}</p>}
      {load.error && <Failed message={load.error} onRetry={load.reload} />}
      {!state && !load.error && <Reading what="Loading keys…" />}
      {state && keys.length === 0 && (
        <p className="td-empty">No invitations yet. Make one and send the code — that is all a tester needs.</p>
      )}

      {keys.length > 0 && (
        <ul className="td-keys">
          {keys.map(k => {
            const spent = k.used_count >= k.max_uses;
            const editing = resending?.code === k.code ? resending : null;
            return (
              <li key={k.code} className={spent ? "spent" : undefined}>
                <button type="button" className="td-code" onClick={() => copy(k.code)}
                  data-tooltip={spent ? "Already used" : "Copy"} aria-label={`Copy ${k.code}`}>
                  <code>{k.code}</code>
                  {copied === k.code ? <IconCheck size={12} /> : <IconCopy size={12} />}
                </button>
                <span className="td-key-meta">
                  <span className="td-pill" data-state={spent ? "used" : "open"}>{spent ? "Used" : "Open"}</span>
                  <span className="td-key-text">
                    {k.plan} · {k.used_count}/{k.max_uses}
                    {k.note ? ` · ${k.note}` : ""}
                    {k.email ? ` · sent to ${k.email}${k.emailed_at ? `, ${sentOn(k.emailed_at)}` : ""}` : ""}
                  </span>
                </span>
                {!spent && mailReady && (editing ? (
                  <form className="td-resend" onSubmit={e => { e.preventDefault(); resend(k.code, editing.to); }}>
                    <input autoFocus type="email" value={editing.to} placeholder="name@example.com"
                      aria-label={`Send ${k.code} to`}
                      onChange={e => setResending({ code: k.code, to: e.target.value })}
                      onKeyDown={e => { if (e.key === "Escape") setResending(null); }} />
                    <button type="submit" className="btn btn-hero btn-sm" disabled={!!busy || !editing.to.trim()}>
                      {busy === `resend:${k.code}` ? "…" : "Send"}
                    </button>
                  </form>
                ) : (
                  <button type="button" className="td-linkbtn" disabled={!!busy}
                    onClick={() => setResending({ code: k.code, to: k.email ?? "" })}>
                    <IconMail size={12} />{k.email ? "Resend" : "Email"}
                  </button>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- Feedback */

export function feedbackCounts(rows: FeedbackRow[]) {
  const by: Record<Severity | "unrated", number> = { critical: 0, high: 0, medium: 0, low: 0, unrated: 0 };
  for (const r of rows) by[r.severity ?? "unrated"]++;
  return by;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function FeedbackPanel({ load }: { load: Loaded<FeedbackRow[]> }) {
  const rows = load.data;
  const by = rows ? feedbackCounts(rows) : null;
  // The database hands the rows over most serious first.
  const latest = (rows ?? []).slice(0, 3);
  return (
    <Card title="Feedback" sub="What testers sent, most serious first (rated by AI).">
      {load.error && <Failed message={load.error} onRetry={load.reload} />}
      {!rows && !load.error && <Reading what="Reading feedback…" />}
      {rows && by && (
        <>
          {rows.length === 0 ? (
            <p className="td-empty">No feedback yet.</p>
          ) : (
            <>
              <div className="td-sevbar" role="img"
                aria-label={`${rows.length} messages: ${SEVERITIES.map(s => `${by[s]} ${s}`).join(", ")}, ${by.unrated} not rated`}>
                {SEVERITIES.map(s => by[s] > 0 && <i key={s} className={`sev-${s}`} style={{ flex: by[s] }} />)}
                {by.unrated > 0 && <i className="sev-none" style={{ flex: by.unrated }} />}
              </div>
              <ul className="td-sevs">
                {SEVERITIES.map(s => (
                  <li key={s}><i className={`sev-${s}`} aria-hidden="true" />{SEVERITY_LABEL[s]}<b>{by[s]}</b></li>
                ))}
                <li><i className="sev-none" aria-hidden="true" />Not rated<b>{by.unrated}</b></li>
              </ul>
              <ul className="td-fb">
                {latest.map(r => (
                  <li key={r.id} className={r.severity ? `sev-${r.severity}` : "sev-none"}>
                    <div className="td-fb-top">
                      <span className={`td-sev${r.severity ? ` sev-${r.severity}` : ""}`}>
                        {r.severity ? SEVERITY_LABEL[r.severity] : "Not rated"}
                      </span>
                      <span className="td-fb-who">{r.email}</span>
                      <span className="td-fb-when">{when(r.createdAt)}</span>
                    </div>
                    <p>{r.message}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link className="btn btn-ghost td-open" href="/dashboard/feedback">
            Open feedback dashboard <IconArrow size={13} />
          </Link>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Agent memory */

export function memoryQuiet(a: MemoryAudit): boolean {
  return a.replies > 20 && a.withMemory === 0;
}

export function MemoryPanel({ load }: { load: Loaded<MemoryAudit> }) {
  const a = load.data;
  const pct = a ? ratio(a.withMemory, a.replies) : 0;
  const quiet = !!a && memoryQuiet(a);
  return (
    <Card title="Agent memory" tone={quiet ? "bad" : undefined}
      sub="Is the agent still learning? Your own account's replies."
      action={
        <button type="button" className="icon-btn" onClick={load.reload} disabled={load.busy}
          data-tooltip="Read again" aria-label="Read the agent memory again">
          <IconRefresh size={14} />
        </button>
      }>
      {load.error && <Failed message={load.error} onRetry={load.reload} />}
      {!a && !load.error && <Reading what="Reading your projects…" />}
      {a && (
        <>
          <div className="td-mem-top">
            <div className="td-bignum" data-quiet={quiet || undefined}>
              <b>{pct}%</b>
              <span>of {a.replies} replies taught the agent something</span>
            </div>
          </div>
          <ul className="td-roles">
            {(["consultant", "coach"] as const).map(r => {
              const x = a.byRole[r];
              return (
                <li key={r}>
                  <span className="k">{r === "coach" ? "Coach" : "Consultant"}</span>
                  <span className="v">{x.marked} / {x.replies}</span>
                  <span className="td-meter" aria-hidden="true"><i style={{ width: `${ratio(x.marked, x.replies)}%` }} /></span>
                </li>
              );
            })}
          </ul>

          {quiet && (
            <p className="td-warn" role="status">
              Nothing has been learned across {a.replies} replies. The marker instruction is in the system prompt — if
              that number stays at zero after a prompt change, the change is what stopped it.
            </p>
          )}

          {a.lessons.length > 0 && (
            <details className="td-lessons">
              <summary>{a.lessons.length} lessons across {a.projects} projects</summary>
              <ul>
                {a.lessons.map((l, i) => (
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
          {a.lessons.length === 0 && !quiet && (
            <p className="td-hint">No lessons yet. Finish a project and the agent writes down what it would do differently next time.</p>
          )}
        </>
      )}
    </Card>
  );
}
