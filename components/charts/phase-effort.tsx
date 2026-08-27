"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { RoadmapData } from "@/lib/api";

type Phase = NonNullable<RoadmapData["phases"]>[number];

const COLORS = { S: "#86efac", M: "#22c55e", L: "#15803d" };
const LABEL = { S: "Klein", M: "Mittel", L: "Groß" };

// Effort mix per roadmap phase — a stacked bar that shows where the heavy lifting
// sits across the plan. Rendered only when the phases actually carry effort tags.
export function PhaseEffortChart({ phases }: { phases: Phase[] }) {
  const data = phases.map((p, i) => {
    const row: { name: string; S: number; M: number; L: number } = {
      name: `Phase ${i + 1}`, S: 0, M: 0, L: 0,
    };
    for (const s of p.steps ?? []) {
      const e = (s.effort || "").trim().toUpperCase();
      if (e.startsWith("S")) row.S++;
      else if (e.startsWith("L") || e.startsWith("XL")) row.L++;
      else if (e.startsWith("M")) row.M++;
    }
    return row;
  });

  const total = data.reduce((s, r) => s + r.S + r.M + r.L, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900 mb-1">Aufwand je Phase</h2>
      <p className="text-xs text-zinc-400 mb-4">Maßnahmen nach Umsetzungsaufwand</p>
      <div className="h-[220px] -ml-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.03)" }}
              contentStyle={{ borderRadius: 10, border: "1px solid #e4e4e7", fontSize: 12 }}
            />
            <Legend iconType="circle" formatter={v => <span style={{ fontSize: 12, color: "#52525b" }}>{v}</span>} />
            <Bar dataKey="S" stackId="a" name={LABEL.S} fill={COLORS.S} radius={[0, 0, 0, 0]} />
            <Bar dataKey="M" stackId="a" name={LABEL.M} fill={COLORS.M} />
            <Bar dataKey="L" stackId="a" name={LABEL.L} fill={COLORS.L} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
