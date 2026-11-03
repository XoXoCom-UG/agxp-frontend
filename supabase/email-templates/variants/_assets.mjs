/*
 * Draws the images the email variants load from {{ .SiteURL }}/brand/email/.
 * Run once from the repo root:  node supabase/email-templates/variants/_assets.mjs
 *
 * mark.png    the current mark (components/layout/brand-logo.tsx BRAND_MARK_SVG):
 *             blue Consultant stroke + violet Coach stroke. /brand/mark.png is the
 *             older all-blue X and no longer matches the app.
 * orbit.jpg   /brand/core.jpg cropped for a 560px email, fading into the card
 *             colour at the bottom so the hero has no hard edge.
 * horizon.png the mark on the orbit, the two agents as dots in the stroke colours,
 *             on a starfield. Fades into #0B0C11 at the bottom.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const out = path.join(root, "public/brand/email");
mkdirSync(out, { recursive: true });

const MARK_A = "M12.4 12.4 L27.6 27.6";
const MARK_B = "M27.6 12.4 L12.4 27.6";

/** The mark's inner drawing, in a 40×40 box, with ids prefixed so two copies can share an SVG. */
function markBody(p) {
  return `
<defs>
<linearGradient id="${p}tile" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#242A38"/><stop offset="1" stop-color="#0B0D14"/></linearGradient>
<linearGradient id="${p}a" x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8FC2FF"/><stop offset="1" stop-color="#2E7BC4"/></linearGradient>
<linearGradient id="${p}b" x1="28" y1="12" x2="12" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C3AEFF"/><stop offset="1" stop-color="#6D5BD0"/></linearGradient>
<radialGradient id="${p}glow" cx="20" cy="20" r="13" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7FB4FF" stop-opacity="0.55"/><stop offset="1" stop-color="#7FB4FF" stop-opacity="0"/></radialGradient>
</defs>
<rect x="1" y="1" width="38" height="38" rx="12" fill="url(#${p}tile)"/>
<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="11.4" fill="none" stroke="rgba(150,185,255,0.30)" stroke-width="1.2"/>
<circle cx="20" cy="20" r="13" fill="url(#${p}glow)"/>
<path d="${MARK_A}" stroke="url(#${p}a)" stroke-width="5.6" stroke-linecap="round"/>
<path d="${MARK_B}" stroke="url(#${p}b)" stroke-width="5.6" stroke-linecap="round"/>
<circle cx="20" cy="20" r="3.1" fill="#0B0D14"/>
<circle cx="20" cy="20" r="2.2" fill="#FFFFFF"/>`;
}

// A seeded random, so re-running draws the same sky.
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* ---- mark.png: 168px, shown at 24–56px ---------------------------------- */
await sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 40 40" fill="none">${markBody("m")}</svg>`,
)).png().toFile(path.join(out, "mark.png"));

/* ---- orbit.jpg: 1120×486, shown at 560×243 ------------------------------ */
{
  const W = 1120, H = 486, CARD = "#141416";
  const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
<stop offset="0.55" stop-color="${CARD}" stop-opacity="0"/><stop offset="1" stop-color="${CARD}" stop-opacity="1"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${CARD}" stop-opacity="0.55"/><stop offset="0.18" stop-color="${CARD}" stop-opacity="0"/>
<stop offset="0.82" stop-color="${CARD}" stop-opacity="0"/><stop offset="1" stop-color="${CARD}" stop-opacity="0.55"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#s)"/><rect width="${W}" height="${H}" fill="url(#f)"/></svg>`);
  await sharp(path.join(root, "public/brand/core.jpg"))
    .resize(W, H, { fit: "cover", position: "centre" })
    .composite([{ input: fade }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(out, "orbit.jpg"));
}

/* ---- horizon.png: 1120×400, shown at 560×200 ---------------------------- */
{
  const W = 1120, H = 400, cx = 560, cy = 196, END = "#0B0C11";
  const r = rng(20261103);
  let stars = "";
  for (let i = 0; i < 170; i++) {
    const x = r() * W, y = r() * H * 0.92, s = r();
    const rad = s > 0.94 ? 2.2 : s > 0.7 ? 1.5 : 1;
    const op = (0.18 + r() * 0.55) * (1 - Math.max(0, (y - 300) / 120));
    const fill = r() > 0.55 ? "#9CC5F5" : "#FFFFFF";
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${fill}" opacity="${op.toFixed(2)}"/>`;
  }
  // The orbit: an ellipse tilted a little, like core.jpg's ring.
  const rx = 330, ry = 64, tilt = -7;
  const onOrbit = deg => {
    const t = (deg * Math.PI) / 180, a = (tilt * Math.PI) / 180;
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
  };
  const [ax, ay] = onOrbit(196); // Consultant, left, blue
  const [bx, by] = onOrbit(16);  // Coach, right, violet
  const agent = (x, y, core, halo) => `
<circle cx="${x}" cy="${y}" r="26" fill="url(#${halo})"/>
<circle cx="${x}" cy="${y}" r="9" fill="${core}"/>
<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1.5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070809"/><stop offset="1" stop-color="${END}"/></linearGradient>
<radialGradient id="bloom" cx="${cx}" cy="${cy}" r="360" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2E7BC4" stop-opacity="0.34"/><stop offset="0.55" stop-color="#2E7BC4" stop-opacity="0.08"/><stop offset="1" stop-color="#2E7BC4" stop-opacity="0"/></radialGradient>
<radialGradient id="ha" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8FC2FF" stop-opacity="0.55"/><stop offset="1" stop-color="#8FC2FF" stop-opacity="0"/></radialGradient>
<radialGradient id="hb" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#C3AEFF" stop-opacity="0.55"/><stop offset="1" stop-color="#C3AEFF" stop-opacity="0"/></radialGradient>
<linearGradient id="ring" x1="${cx - rx}" y1="0" x2="${cx + rx}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8FC2FF" stop-opacity="0.15"/><stop offset="0.5" stop-color="#8FC2FF" stop-opacity="0.5"/><stop offset="1" stop-color="#C3AEFF" stop-opacity="0.15"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.7" stop-color="${END}" stop-opacity="0"/><stop offset="1" stop-color="${END}" stop-opacity="1"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars}
<rect width="${W}" height="${H}" fill="url(#bloom)"/>
<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${tilt} ${cx} ${cy})" stroke="url(#ring)" stroke-width="2"/>
<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.72}" ry="${ry * 0.72}" transform="rotate(${tilt} ${cx} ${cy})" stroke="#8FC2FF" stroke-opacity="0.12" stroke-width="1.5"/>
${agent(ax.toFixed(1), ay.toFixed(1), "#4D9BE6", "ha")}
${agent(bx.toFixed(1), by.toFixed(1), "#9179EE", "hb")}
<g transform="translate(${cx - 64} ${cy - 64}) scale(3.2)">${markBody("mk")}</g>
<rect width="${W}" height="${H}" fill="url(#fade)"/>
</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(path.join(out, "horizon.png"));
}

console.log("wrote", out);
