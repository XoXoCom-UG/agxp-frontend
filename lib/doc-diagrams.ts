/**
 * doc-diagrams.ts — the document's diagrams, drawn as inline SVG.
 *
 * The method sheet ("AgxP – Method Groups per Consultant") shows a picture for
 * a good third of its methods: a quadrant for the Stakeholder Map and the
 * Use-Case Prioritization, a box-and-arrow diagram for the IT Landscape, the
 * Integration Blueprint, the Architecture Overview, the pipeline, the loops and
 * the 5 Whys, a sequence diagram for Process Mapping. These three renderers are
 * those pictures: `agxp-quadrant`, `agxp-graph`, `agxp-sequence`.
 *
 * The agent writes plain lines, never SVG. Same rules as doc-visuals.ts:
 *
 * SECURITY: md() HTML-escapes the whole message BEFORE it reaches here, so every
 * string that arrives is already escaped — including `>` in an arrow, which
 * is `&gt;` by now. Nothing is ever added to the markup except numbers computed
 * here and fixed class names. Colours are CSS classes (app/doc-visuals.css), so
 * the diagrams follow the theme and survive print.
 */

/** `;`-separated, but not inside an HTML entity (`Won&#39;t` is one word). */
export const semi = (s: string): string[] =>
  s.split(/(?<!&(?:#\d+|amp|lt|gt|quot));/).map(x => x.trim()).filter(Boolean);

const lines = (body: string) => body.split("\n").map(l => l.trim()).filter(Boolean);

/** First number in a string, or NaN. */
const num = (s: string): number => {
  const m = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
};

const f = (n: number) => Math.round(n * 10) / 10;

/** Greedy word wrap into at most `lines` lines; the last one is cut with an ellipsis. */
export function wrap(text: string, max: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return out;
}

/** SVG text with its lines centred on (x, y). */
function textBlock(ls: string[], x: number, y: number, cls: string, lh = 14): string {
  const top = y - ((ls.length - 1) * lh) / 2;
  return `<text class="${cls}" x="${f(x)}" text-anchor="middle">` +
    ls.map((l, i) => `<tspan x="${f(x)}" y="${f(top + i * lh)}" dy="0.35em">${l}</tspan>`).join("") +
    `</text>`;
}

/* ============================== QUADRANT =============================== */

/**
 * `agxp-quadrant` — a 2×2 with points.
 *
 *   x: Low interest | High interest
 *   y: Low influence | High influence
 *   q: Monitor | Keep informed | Keep satisfied | Manage closely
 *   Works council | 35 | 75
 *
 * `q:` names the four fields in reading order of the picture's bottom row then
 * top row (bottom-left, bottom-right, top-left, top-right). Points are
 * `name | x | y`, both 0–100, y counted upwards.
 */
export function quadrant(body: string): string {
  let xs = ["Niedrig", "Hoch"], ys = ["Niedrig", "Hoch"];
  let qs = ["", "", "", ""];
  let title = "";
  const pts: { name: string; x: number; y: number }[] = [];
  for (const l of lines(body)) {
    const key = l.match(/^(x|y|q|titel|title)\s*:\s*(.*)$/i);
    if (key) {
      const parts = key[2].split("|").map(s => s.trim());
      const k = key[1].toLowerCase();
      if (k === "x" && parts.length >= 2) xs = parts;
      else if (k === "y" && parts.length >= 2) ys = parts;
      else if (k === "q") qs = [0, 1, 2, 3].map(i => parts[i] ?? "");
      else if (k === "titel" || k === "title") title = key[2].trim();
      continue;
    }
    const [name, x, y] = l.split("|").map(s => s.trim());
    const nx = num(x ?? ""), ny = num(y ?? "");
    if (name && isFinite(nx) && isFinite(ny)) {
      pts.push({ name, x: Math.max(3, Math.min(97, nx)), y: Math.max(3, Math.min(97, ny)) });
    }
  }
  if (!pts.length) return "";

  const L = 64, T = title ? 34 : 14, W = 540, H = 330;
  const px = (v: number) => L + (v / 100) * W;
  const py = (v: number) => T + H - (v / 100) * H;
  const cx = L + W / 2, cy = T + H / 2;

  let s = `<svg class="v-quad" viewBox="0 0 ${L + W + 14} ${T + H + 44}" role="img" xmlns="http://www.w3.org/2000/svg">`;
  if (title) s += `<text class="q-title" x="${L + W / 2}" y="20" text-anchor="middle">${title}</text>`;
  // The four fields; the top-right one is the lit one (high on both axes).
  s += `<rect class="q-f" x="${L}" y="${T}" width="${W / 2}" height="${H / 2}"/>` +
    `<rect class="q-f hot" x="${cx}" y="${T}" width="${W / 2}" height="${H / 2}"/>` +
    `<rect class="q-f" x="${L}" y="${cy}" width="${W / 2}" height="${H / 2}"/>` +
    `<rect class="q-f" x="${cx}" y="${cy}" width="${W / 2}" height="${H / 2}"/>`;
  // Field names sit in the top of each field: bottom-left, bottom-right, top-left, top-right.
  const field = [[L + W / 4, cy + 16], [cx + W / 4, cy + 16], [L + W / 4, T + 16], [cx + W / 4, T + 16]];
  qs.forEach((q, i) => { if (q) s += `<text class="q-name" x="${f(field[i][0])}" y="${field[i][1]}" text-anchor="middle">${q}</text>`; });
  // Axis words.
  s += `<text class="q-ax" x="${L + W / 4}" y="${T + H + 20}" text-anchor="middle">${xs[0]}</text>` +
    `<text class="q-ax" x="${cx + W / 4}" y="${T + H + 20}" text-anchor="middle">${xs[1]}</text>` +
    `<text class="q-ax" transform="translate(16 ${T + H * 0.75}) rotate(-90)" text-anchor="middle">${ys[0]}</text>` +
    `<text class="q-ax" transform="translate(16 ${T + H * 0.25}) rotate(-90)" text-anchor="middle">${ys[1]}</text>`;
  for (const p of pts) {
    const x = px(p.x), y = py(p.y);
    const right = p.x > 68;
    s += `<circle class="q-dot" cx="${f(x)}" cy="${f(y)}" r="5.5"/>` +
      `<text class="q-pt" x="${f(right ? x - 9 : x + 9)}" y="${f(y + 4)}" text-anchor="${right ? "end" : "start"}">${p.name}</text>`;
  }
  return `<div class="v-quad-wrap">${s}</svg></div>`;
}

/* ================================ GRAPH ================================ */

type Shape = "box" | "db" | "model" | "goal" | "decision" | "person" | "group";
interface GNode { id: string; label: string; shape: Shape; tone: string; rank: number; slot: number; x: number; y: number; w: number; h: number }
interface GEdge { from: string; to: string; label: string; style: string; back: boolean }

const SHAPES = new Set(["box", "db", "model", "goal", "decision", "person", "group"]);
const TONES = new Set(["warn", "ok", "bad", "star", "muted"]);
const ARROW = /^(\w+)\s*(-{1,2})&gt;\s*(\w+)\s*(?::\s*(.*))?$/;

/**
 * `agxp-graph` — boxes and arrows.
 *
 *   dir: LR
 *   A: Claims core | db | warn
 *   B: AI triage | model | ok
 *   A -> B : nightly batch
 *   B --> A : result | red
 *
 * A node line is `id: label | shape | tone`; shape is box, db, model, goal,
 * decision, person or group (dashed), tone warn, ok, bad, star or muted. `->` is
 * a solid edge, `-->` a dashed one; a trailing `| red` colours it (a new
 * interface on a legacy system). An edge that points back up the chain is drawn
 * under the nodes, which is how a loop reads. The layout is layered: each node
 * sits one column (or row, with `dir: TB`) after its latest predecessor.
 */
export function graph(body: string): string {
  let dir: "LR" | "TB" = "LR";
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const node = (id: string, label?: string, shape?: string, tone?: string) => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, label: label ?? id, shape: "box", tone: "", rank: 0, slot: 0, x: 0, y: 0, w: 0, h: 0 };
      nodes.set(id, n);
    }
    if (label) n.label = label;
    if (shape && SHAPES.has(shape)) n.shape = shape as Shape;
    if (tone && TONES.has(tone)) n.tone = tone;
    return n;
  };

  for (const l of lines(body)) {
    const d = l.match(/^dir\s*:\s*(LR|TB)\s*$/i);
    if (d) { dir = d[1].toUpperCase() as "LR" | "TB"; continue; }
    const e = l.match(ARROW);
    if (e) {
      const [label = "", style = ""] = (e[4] ?? "").split("|").map(s => s.trim());
      node(e[1]); node(e[3]);
      edges.push({ from: e[1], to: e[3], label, style: (e[2].length === 2 ? "dashed " : "") + style.toLowerCase(), back: false });
      continue;
    }
    const n = l.match(/^(\w+)\s*:\s*(.+)$/);
    if (n) {
      const [label, shape, tone] = n[2].split("|").map(s => s.trim());
      node(n[1], label, shape?.toLowerCase(), tone?.toLowerCase());
    }
  }
  if (!nodes.size || nodes.size > 24) return "";

  // Back edges: the ones that close a cycle in a depth-first walk from the first node.
  const out = new Map<string, GEdge[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const state = new Map<string, 1 | 2>();
  const walk = (id: string) => {
    state.set(id, 1);
    for (const e of out.get(id) ?? []) {
      const st = state.get(e.to);
      if (st === 1 || e.to === id) e.back = true;
      else if (!st) walk(e.to);
    }
    state.set(id, 2);
  };
  for (const id of nodes.keys()) if (!state.has(id)) walk(id);

  // Rank = the longest forward path that reaches the node.
  const fwd = edges.filter(e => !e.back);
  for (let pass = 0; pass < nodes.size; pass++) {
    let changed = false;
    for (const e of fwd) {
      const a = nodes.get(e.from)!, b = nodes.get(e.to)!;
      if (b.rank < a.rank + 1) { b.rank = a.rank + 1; changed = true; }
    }
    if (!changed) break;
  }

  // Slot inside the rank: insertion order, then one barycentre pass towards the parents.
  const ranks: GNode[][] = [];
  for (const n of nodes.values()) (ranks[n.rank] ??= []).push(n);
  ranks.forEach(r => r.forEach((n, i) => { n.slot = i; }));
  for (let r = 1; r < ranks.length; r++) {
    const bary = (n: GNode) => {
      const ps = fwd.filter(e => e.to === n.id).map(e => nodes.get(e.from)!.slot);
      return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : n.slot;
    };
    ranks[r].sort((a, b) => bary(a) - bary(b));
    ranks[r].forEach((n, i) => { n.slot = i; });
  }

  const lr = dir === "LR";
  const NW = lr ? 150 : 170, NH = lr ? 56 : 50, GX = lr ? 74 : 36, GY = lr ? 26 : 46;
  const maxSlots = Math.max(...ranks.map(r => r?.length ?? 0));
  const span = (count: number) => (lr ? count * NH + (count - 1) * GY : count * NW + (count - 1) * GX);
  const full = span(maxSlots);
  for (const n of nodes.values()) {
    const count = ranks[n.rank].length;
    const off = (full - span(count)) / 2;
    n.w = NW; n.h = NH;
    if (lr) { n.x = n.rank * (NW + GX); n.y = off + n.slot * (NH + GY); }
    else { n.x = off + n.slot * (NW + GX); n.y = n.rank * (NH + GY); }
  }
  const depth = ranks.length;
  const gw = lr ? depth * NW + (depth - 1) * GX : full;
  const gh = lr ? full : depth * NH + (depth - 1) * GY;

  const back = edges.filter(e => e.back);
  // A back edge whose target has nodes under it would climb through them: it goes round the left side instead.
  const lane = (e: GEdge) => lr && ranks[nodes.get(e.to)!.rank].some(n => n.slot > nodes.get(e.to)!.slot);
  const side = back.filter(lane);
  const pad = 14, below = back.length ? 34 + back.length * 14 : 0;
  const padL = side.length ? 18 + side.length * 10 : 0;
  const VW = gw + pad * 2 + padL, VH = gh + pad * 2 + below;
  const defs = `<defs>` +
    `<marker id="agx-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="g-tip" d="M0 0L10 5L0 10z"/></marker>` +
    `<marker id="agx-arr-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="g-tip red" d="M0 0L10 5L0 10z"/></marker>` +
    `</defs>`;

  let shapes = "", paths = "", labels = "";
  for (const n of nodes.values()) {
    const x = n.x + pad, y = n.y + pad, w = n.w, h = n.h, cx = x + w / 2, cy = y + h / 2;
    const cls = `g-node ${n.shape}${n.tone ? ` t-${n.tone}` : ""}`;
    switch (n.shape) {
      case "db": {
        const ry = 7;
        shapes += `<path class="${cls}" d="M${x} ${y + ry}a${w / 2} ${ry} 0 0 1 ${w} 0v${h - 2 * ry}a${w / 2} ${ry} 0 0 1 -${w} 0z"/>` +
          `<path class="${cls} lid" d="M${x} ${y + ry}a${w / 2} ${ry} 0 0 0 ${w} 0"/>`;
        break;
      }
      case "model": {
        const k = 16;
        shapes += `<polygon class="${cls}" points="${x + k},${y} ${x + w - k},${y} ${x + w},${cy} ${x + w - k},${y + h} ${x + k},${y + h} ${x},${cy}"/>`;
        break;
      }
      case "goal":
        shapes += `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}"/>`;
        break;
      case "decision":
        shapes += `<polygon class="${cls}" points="${cx},${y - 4} ${x + w + 4},${cy} ${cx},${y + h + 4} ${x - 4},${cy}"/>`;
        break;
      default:
        shapes += `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${n.shape === "person" ? 22 : 8}"/>`;
    }
    const ls = wrap(n.label, n.shape === "decision" ? 14 : 20, n.shape === "decision" ? 2 : 3);
    shapes += textBlock(ls, cx, cy + (n.shape === "db" ? 3 : 0), "g-text");
  }

  // Edges. Forward ones leave the near side of the source and enter the near side of the target.
  const sideOut = (n: GNode) => (lr ? [n.x + pad + n.w, n.y + pad + n.h / 2] : [n.x + pad + n.w / 2, n.y + pad + n.h]);
  const sideIn = (n: GNode) => (lr ? [n.x + pad, n.y + pad + n.h / 2] : [n.x + pad + n.w / 2, n.y + pad]);
  const label = (text: string, x: number, y: number, red: boolean) => {
    if (!text) return "";
    const w = Math.min(190, text.length * 5.6 + 12);
    return `<rect class="g-lbg" x="${f(x - w / 2)}" y="${f(y - 9)}" width="${f(w)}" height="17" rx="4"/>` +
      `<text class="g-label${red ? " red" : ""}" x="${f(x)}" y="${f(y)}" text-anchor="middle" dy="0.35em">${text}</text>`;
  };
  edges.forEach(e => {
    const a = nodes.get(e.from)!, b = nodes.get(e.to)!;
    const red = /\bred\b/.test(e.style), dashed = /\bdashed\b/.test(e.style);
    const cls = `g-edge${red ? " red" : ""}${dashed ? " dashed" : ""}`;
    const mk = red ? "agx-arr-red" : "agx-arr";
    if (e.back) {
      const i = back.indexOf(e);
      const [sx, sy] = lr ? [a.x + pad + a.w / 2, a.y + pad + a.h] : [a.x + pad, a.y + pad + a.h / 2];
      const [tx, ty] = lr ? [b.x + pad + b.w / 2, b.y + pad + b.h] : [b.x + pad, b.y + pad + b.h / 2];
      if (lr && lane(e)) {
        // Down from the source, left under everything, up the left margin, into the target's left side.
        const dip = gh + pad + 18 + i * 14;
        const lx = pad - 10 - side.indexOf(e) * 10;
        const ey = b.y + pad + b.h / 2, ex = b.x + pad, r = 8;
        paths += `<path class="${cls}" d="M${f(sx)} ${f(sy)}V${f(dip - r)}Q${f(sx)} ${f(dip)} ${f(sx - r)} ${f(dip)}H${f(lx + r)}` +
          `Q${f(lx)} ${f(dip)} ${f(lx)} ${f(dip - r)}V${f(ey + r)}Q${f(lx)} ${f(ey)} ${f(lx + r)} ${f(ey)}H${f(ex)}" marker-end="url(#${mk})"/>`;
        labels += label(e.label, (sx + lx) / 2, dip, red);
      } else if (lr) {
        const dip = gh + pad + 18 + i * 14;
        paths += `<path class="${cls}" d="M${f(sx)} ${f(sy)}C${f(sx)} ${f(dip + 22)} ${f(tx)} ${f(dip + 22)} ${f(tx)} ${f(ty)}" marker-end="url(#${mk})"/>`;
        labels += label(e.label, (sx + tx) / 2, dip + 16, red);
      } else {
        const bulge = pad - 4 - i * 8;
        paths += `<path class="${cls}" d="M${f(sx)} ${f(sy)}C${f(bulge - 40)} ${f(sy)} ${f(bulge - 40)} ${f(ty)} ${f(tx)} ${f(ty)}" marker-end="url(#${mk})"/>`;
        labels += label(e.label, Math.max(40, bulge - 24), (sy + ty) / 2, red);
      }
      return;
    }
    const [sx, sy] = sideOut(a), [tx, ty] = sideIn(b);
    if (lr) {
      const mx = (sx + tx) / 2;
      paths += `<path class="${cls}" d="M${f(sx)} ${f(sy)}C${f(mx)} ${f(sy)} ${f(mx)} ${f(ty)} ${f(tx)} ${f(ty)}" marker-end="url(#${mk})"/>`;
      labels += label(e.label, mx, (sy + ty) / 2 - (Math.abs(sy - ty) < 6 ? 14 : 0), red);
    } else {
      const my = (sy + ty) / 2;
      paths += `<path class="${cls}" d="M${f(sx)} ${f(sy)}C${f(sx)} ${f(my)} ${f(tx)} ${f(my)} ${f(tx)} ${f(ty)}" marker-end="url(#${mk})"/>`;
      labels += label(e.label, (sx + tx) / 2, my, red);
    }
  });

  return `<div class="v-graph-wrap"><svg class="v-graph" viewBox="0 0 ${f(VW)} ${f(VH)}" style="max-width:${Math.min(920, Math.round(VW * 1.15))}px" role="img" xmlns="http://www.w3.org/2000/svg">` +
    `${defs}<g transform="translate(${padL} 0)">${paths}${shapes}${labels}</g></svg></div>`;
}

/* ============================== SEQUENCE =============================== */

/**
 * `agxp-sequence` — who says what to whom, in order.
 *
 *   Host | System | Player
 *   Host -> System : Create game (playlist)
 *   System --> Host : Game code
 *   loop: 10 rounds
 *   System -> Player : Play clip + 4 options *
 *   Player -> System : Answer
 *   end
 *
 * The first line names the lanes (without it they are taken from the messages in
 * order). `->` is a call, `-->` a dashed return; a `*` at the end of a message
 * marks an automated step. `loop: text` … `end` draws a frame around what is
 * inside it.
 */
export function sequence(body: string): string {
  const ls = lines(body);
  const actors: string[] = [];
  const add = (a: string) => { if (!actors.includes(a)) actors.push(a); };
  if (ls[0] && !ls[0].includes("&gt;") && ls[0].includes("|") && !/^(loop|end)/i.test(ls[0])) {
    ls.shift()!.split("|").map(s => s.trim()).filter(Boolean).forEach(add);
  }
  type Step = { kind: "msg"; from: string; to: string; text: string; dashed: boolean; auto: boolean } | { kind: "loop"; text: string } | { kind: "end" };
  const steps: Step[] = [];
  for (const l of ls) {
    const lp = l.match(/^loop\s*:?\s*(.*)$/i);
    if (lp) { steps.push({ kind: "loop", text: lp[1] }); continue; }
    if (/^end$/i.test(l)) { steps.push({ kind: "end" }); continue; }
    const m = l.match(/^(.+?)\s*(-{1,2})&gt;\s*(.+?)\s*(?::\s*(.*))?$/);
    if (!m) continue;
    const from = m[1].trim(), to = m[3].trim();
    add(from); add(to);
    let text = (m[4] ?? "").trim();
    const auto = /\*$/.test(text);
    if (auto) text = text.replace(/\s*\*$/, "");
    steps.push({ kind: "msg", from, to, text, dashed: m[2].length === 2, auto });
  }
  const msgs = steps.filter(s => s.kind === "msg").length;
  if (!msgs || actors.length < 2 || actors.length > 7 || msgs > 30) return "";

  const COL = Math.max(120, Math.min(190, Math.floor(760 / actors.length)));
  const BOX = 92, HEAD = 34, GAP = 44;
  const ax = (a: string) => COL / 2 + actors.indexOf(a) * COL;
  const W = COL * actors.length;
  let y = HEAD + 26;
  let body_ = "", frames = "";
  const open: { y: number; text: string }[] = [];
  for (const s of steps) {
    if (s.kind === "loop") { open.push({ y: y - 14, text: s.text }); y += 10; continue; }
    if (s.kind === "end") {
      const o = open.pop();
      if (o) {
        frames += `<rect class="s-frame" x="${f(COL / 2 - 40)}" y="${f(o.y)}" width="${f(W - COL + 80)}" height="${f(y - o.y - 6)}" rx="4"/>` +
          `<text class="s-ftab" x="${f(COL / 2 - 34)}" y="${f(o.y + 12)}">loop${o.text ? " · " + o.text : ""}</text>`;
      }
      y += 8; continue;
    }
    const x1 = ax(s.from), x2 = ax(s.to);
    const self = s.from === s.to;
    if (self) {
      body_ += `<path class="s-msg${s.dashed ? " dashed" : ""}" d="M${f(x1)} ${f(y)}h28v16h-28" marker-end="url(#agx-arr)"/>` +
        `<text class="s-txt" x="${f(x1 + 34)}" y="${f(y + 10)}">${s.text}${s.auto ? " ⚙" : ""}</text>`;
    } else {
      body_ += `<path class="s-msg${s.dashed ? " dashed" : ""}" d="M${f(x1)} ${f(y)}H${f(x2)}" marker-end="url(#agx-arr)"/>` +
        `<text class="s-txt" x="${f((x1 + x2) / 2)}" y="${f(y - 6)}" text-anchor="middle">${s.text}${s.auto ? " ⚙" : ""}</text>`;
    }
    y += GAP;
  }
  const bottom = y + 6;
  let lanes = "", heads = "";
  for (const a of actors) {
    const x = ax(a);
    lanes += `<path class="s-life" d="M${f(x)} ${HEAD} V${f(bottom)}"/>`;
    for (const yy of [0, bottom]) {
      heads += `<rect class="s-head" x="${f(x - BOX / 2)}" y="${yy}" width="${BOX}" height="${HEAD}" rx="6"/>` +
        textBlock(wrap(a, 14, 2), x, yy + HEAD / 2, "s-name", 12);
    }
  }
  const defs = `<defs><marker id="agx-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="g-tip" d="M0 0L10 5L0 10z"/></marker></defs>`;
  return `<div class="v-graph-wrap"><svg class="v-seq" viewBox="0 0 ${W} ${f(bottom + HEAD + 2)}" style="max-width:${Math.min(920, W)}px" role="img" xmlns="http://www.w3.org/2000/svg">` +
    `${defs}${lanes}${frames}${body_}${heads}</svg></div>`;
}
