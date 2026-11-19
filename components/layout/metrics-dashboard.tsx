"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconRefresh } from "@/components/layout/agxp-icons";
import { MONTHLY_BUDGET_USD, FREE_POOL_BUDGET_USD } from "@/lib/plans";
import {
  RANGES, IDLE_HIDE_MS, usd, pct, groupCount, typeLabel, total, shortDay, shortMonth, mergeGroups,
  type MetricsOverview, type AccessLogRow, type DayPoint, type Group,
} from "@/lib/metrics";

/**
 * /metrics, once the viewer is allowed and has passed the second factor.
 *
 * Reads only through /api/metrics, which reads only through metrics_overview()
 * and metrics_access_log() (migration 0033) with the viewer's own token. Every
 * load is logged in the database. The numbers are hidden again after 15 minutes
 * without a touch, so a screen left open in a meeting room does not keep showing them.
 */

async function fetchJson<T>(token: string, query: string): Promise<T> {
  const res = await fetch(`/api/metrics?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body.refused === "mfa_required") throw new Error("mfa_required");
    throw new Error(body.error || (body.refused ? "This account can't see the metrics." : `Error ${res.status}`));
  }
  return body as T;
}

export function MetricsDashboard({ token, onMfaLost }: { token: string; onMfaLost: () => void }) {
  const [days, setDays] = useState<number>(30);
  const [team, setTeam] = useState(false);
  const [data, setData] = useState<MetricsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [log, setLog] = useState<AccessLogRow[] | null>(null);
  const lastTouch = useRef(0);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      setData(await fetchJson<MetricsOverview>(token, `days=${days}&team=${team ? 1 : 0}`));
      setHidden(false);
      lastTouch.current = Date.now();
    } catch (e) {
      if ((e as Error).message === "mfa_required") { onMfaLost(); return; }
      setError((e as Error).message);
    } finally { setBusy(false); }
  }, [token, days, team, onMfaLost]);

  // Loaded through a microtask so the effect itself does not set state synchronously.
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  // Hide after a quiet spell.
  useEffect(() => {
    const touch = () => { lastTouch.current = Date.now(); };
    const events = ["pointermove", "keydown", "scroll", "touchstart"] as const;
    for (const ev of events) window.addEventListener(ev, touch, { passive: true });
    const timer = window.setInterval(() => {
      if (lastTouch.current && Date.now() - lastTouch.current > IDLE_HIDE_MS) {
        setData(null); setLog(null); setHidden(true);
      }
    }, 30_000);
    return () => {
      for (const ev of events) window.removeEventListener(ev, touch);
      window.clearInterval(timer);
    };
  }, []);

  async function loadLog() {
    try { setLog((await fetchJson<{ rows: AccessLogRow[] }>(token, "view=log")).rows); }
    catch (e) { setError((e as Error).message); }
  }

  if (hidden) return (
    <div className="mx-hidden">
      <p>The numbers were hidden after 15 minutes without activity.</p>
      <button className="btn btn-solid" onClick={() => void load()}>Show them again</button>
    </div>
  );

  return (
    <>
      <div className="mx-controls" role="toolbar" aria-label="Filters">
        <div className="mx-seg" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button key={r} className="fbd-chip" aria-pressed={days === r} onClick={() => setDays(r)}>{r} days</button>
          ))}
        </div>
        <label className="mx-toggle">
          <input type="checkbox" checked={team} onChange={e => setTeam(e.target.checked)} />
          Include team accounts (@xoxocom.net)
        </label>
        <button className="btn btn-ghost btn-sm mx-refresh" onClick={() => void load()} disabled={busy} aria-label="Refresh">
          <IconRefresh /> {busy ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="mx-error" role="alert">{error}</p>}
      {!data && !error && <p className="mx-muted" role="status">Loading the numbers…</p>}

      {data && <Overview data={data} />}

      {data && (
        <section className="mx-card mx-log">
          <div className="mx-card-head">
            <h2>Who looked</h2>
            {!log && <button className="btn btn-ghost btn-sm" onClick={() => void loadLog()}>Show access log</button>}
          </div>
          <p className="mx-muted">Every load of this page is written to a log nobody here can edit — refused attempts too.</p>
          {log && (
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead><tr><th>When</th><th>Who</th><th>What</th><th>Result</th></tr></thead>
                <tbody>
                  {log.map((r, i) => (
                    <tr key={i}>
                      <td>{new Date(r.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{r.who ?? "another account"}</td>
                      <td>{r.what}</td>
                      <td className={r.outcome === "ok" ? "" : "mx-bad"}>{r.outcome === "ok" ? "shown" : r.outcome === "mfa_required" ? "refused: no 2FA" : "refused: no access"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function Overview({ data }: { data: MetricsOverview }) {
  const t = data.totals;
  const s = data.series;
  const monthUsd = data.cost.month_micro_usd / 1_000_000;
  const freeUsd = data.cost.free_pool_micro_usd / 1_000_000;

  return (
    <>
      <div className="mx-tiles">
        <Tile label="Accounts" value={t.accounts} sub={`+${t.accounts_in_range} in ${data.days} days`} />
        <Tile label="Active, 7 days" value={t.active_7} sub={`${t.active_30} in 30 days`} />
        <Tile label="Came back" value={t.returning_30} sub="active on 2+ days, last 30" />
        <Tile label="Projects" value={t.projects_in_range} sub={`${t.projects} all time`} />
        <Tile label="Documents finished" value={t.docs_in_range} sub={`${t.docs} all time`} />
        <Tile label="Messages sent" value={t.messages_in_range} sub={`in ${data.days} days`} />
      </div>

      <div className="mx-grid">
        <ChartCard title="New accounts" series={s} field="accounts" unit="accounts" />
        <ChartCard title="People active" series={s} field="active" unit="active" />
        <ChartCard title="Projects started" series={s} field="projects" unit="projects" />
        <ChartCard title="Documents finished" series={s} field="docs" unit="documents" />
      </div>

      <div className="mx-grid">
        <section className="mx-card">
          <div className="mx-card-head"><h2>From account to document</h2></div>
          <Funnel steps={[
            ["Accounts", data.funnel.accounts],
            ["Started a project", data.funnel.with_project],
            ["Wrote to an agent", data.funnel.with_message],
            ["Got a finished document", data.funnel.with_doc],
          ]} />
        </section>

        <section className="mx-card">
          <div className="mx-card-head"><h2>Cost</h2><span className="mx-muted">all accounts</span></div>
          <Meter label="This month" value={monthUsd} max={MONTHLY_BUDGET_USD} text={`${usd(data.cost.month_micro_usd)} of $${MONTHLY_BUDGET_USD.toLocaleString("en")} budget`} />
          <Meter label="Free accounts pool" value={freeUsd} max={FREE_POOL_BUDGET_USD} text={`${usd(data.cost.free_pool_micro_usd)} of $${FREE_POOL_BUDGET_USD}`} />
          <p className="mx-muted mx-small">Last month {usd(data.cost.last_month_micro_usd)} · {data.cost.requests_month.toLocaleString("en")} model calls this month</p>
          <MonthBars rows={data.cost.by_month} />
        </section>
      </div>

      <div className="mx-grid">
        <section className="mx-card">
          <div className="mx-card-head"><h2>Consultant types chosen</h2><span className="mx-muted">projects</span></div>
          <GroupTable
            rows={data.consultant_types.map(g => ({ label: typeLabel(g.tagline), g }))}
            min={data.min_group}
          />
        </section>
        <section className="mx-card">
          <div className="mx-card-head"><h2>Plans</h2><span className="mx-muted">accounts</span></div>
          <GroupTable rows={data.plans.map(g => ({ label: g.plan[0].toUpperCase() + g.plan.slice(1), g }))} min={data.min_group} />
          <p className="mx-muted mx-small">
            Invitation keys: {data.beta_keys.keys} · seats used {data.beta_keys.seats_used} of {data.beta_keys.seats_total}
          </p>
        </section>
      </div>

      <details className="mx-card mx-details">
        <summary>All daily numbers as a table</summary>
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead><tr><th>Day</th><th>New accounts</th><th>Active</th><th>Projects</th><th>Messages</th><th>Documents</th></tr></thead>
            <tbody>
              {[...s].reverse().map(p => (
                <tr key={p.d}><td>{shortDay(p.d)}</td><td>{p.accounts}</td><td>{p.active}</td><td>{p.projects}</td><td>{p.messages}</td><td>{p.docs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mx-foot mx-muted">
        Totals only — no customer names, emails or conversations ever leave the database.
        Groups under {data.min_group} are shown as “&lt; {data.min_group}”.
        {data.include_team ? " Team accounts included." : " Team accounts (@xoxocom.net) left out; cost is always all accounts."}
        {" "}Updated {new Date(data.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
      </p>
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="mx-tile">
      <span className="mx-tile-label">{label}</span>
      <span className="mx-tile-value">{value.toLocaleString("en")}</span>
      <span className="mx-tile-sub">{sub}</span>
    </div>
  );
}

/** One series, one hue, bars from the baseline, a readout line for the hovered day. */
function ChartCard({ title, series, field, unit }: { title: string; series: DayPoint[]; field: keyof Omit<DayPoint, "d">; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map(p => p[field]));
  const sum = total(series, field);
  const shown = hover == null ? null : series[hover];
  return (
    <section className="mx-card">
      <div className="mx-card-head">
        <h2>{title}</h2>
        <span className="mx-readout" aria-live="polite">
          {shown ? `${shortDay(shown.d)} · ${shown[field]} ${unit}` : `${sum.toLocaleString("en")} total`}
        </span>
      </div>
      <div
        className={`mx-bars${series.length > 45 ? " mx-bars-dense" : ""}`}
        role="img"
        aria-label={`${title}: ${sum} over ${series.length} days, highest ${max} in one day`}
        onMouseLeave={() => setHover(null)}
      >
        <span className="mx-axis-max" aria-hidden="true">{max}</span>
        {series.map((p, i) => (
          <span key={p.d} className="mx-bar-hit" onMouseEnter={() => setHover(i)} aria-hidden="true">
            <span
              className={`mx-bar${hover === i ? " is-hover" : ""}`}
              style={{ height: p[field] ? `${Math.max(3, (p[field] / max) * 100)}%` : "0" }}
            />
          </span>
        ))}
      </div>
      <div className="mx-x" aria-hidden="true">
        <span>{shortDay(series[0]?.d ?? "")}</span>
        <span>{shortDay(series[series.length - 1]?.d ?? "")}</span>
      </div>
    </section>
  );
}

function Funnel({ steps }: { steps: [string, number][] }) {
  const top = steps[0][1] || 1;
  return (
    <ol className="mx-funnel">
      {steps.map(([label, n], i) => (
        <li key={label}>
          <div className="mx-funnel-text">
            <span>{label}</span>
            <span className="mx-num">{n.toLocaleString("en")} <em>{i === 0 ? "" : pct(n, steps[0][1])}</em></span>
          </div>
          <span className="mx-track"><span className="mx-fill" style={{ width: `${(n / top) * 100}%` }} /></span>
        </li>
      ))}
    </ol>
  );
}

function Meter({ label, value, max, text }: { label: string; value: number; max: number; text: string }) {
  const ratio = max ? value / max : 0;
  const warn = ratio >= 0.8;
  return (
    <div className="mx-meter">
      <div className="mx-funnel-text">
        <span>{label}</span>
        <span className="mx-num">{text}{warn && <strong className="mx-warn-label"> · {Math.round(ratio * 100)}% used</strong>}</span>
      </div>
      <span className="mx-track"><span className={`mx-fill${warn ? " is-warn" : ""}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></span>
    </div>
  );
}

function MonthBars({ rows }: { rows: { month: string; micro_usd: number }[] }) {
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map(r => r.micro_usd));
  return (
    <div className="mx-months" role="img" aria-label={`Cost per month: ${rows.map(r => `${shortMonth(r.month)} ${usd(r.micro_usd)}`).join(", ")}`}>
      {rows.map(r => (
        <div key={r.month} className="mx-month" title={`${shortMonth(r.month)}: ${usd(r.micro_usd)}`}>
          <span className="mx-month-val">{usd(r.micro_usd)}</span>
          <span className="mx-month-bar"><span className="mx-bar" style={{ height: `${Math.max(3, (r.micro_usd / max) * 100)}%` }} /></span>
          <span className="mx-month-label">{shortMonth(r.month)}</span>
        </div>
      ))}
    </div>
  );
}

function GroupTable({ rows, min }: { rows: { label: string; g: Group }[]; min: number }) {
  if (!rows.length) return <p className="mx-muted">Nothing yet.</p>;
  return (
    <table className="mx-table mx-groups">
      <tbody>
        {mergeGroups(rows).map(r => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td className="mx-num">{groupCount(r.g, min)}{r.plus && <span title={`plus a group under ${min}`}>+</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
