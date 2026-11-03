/*
 * Builds the email variants: five looks × "Confirm signup" and "Reset password".
 *   node supabase/email-templates/variants/_build.mjs
 *
 * The <look>.html files next to this script are what gets pasted into
 * Supabase → Authentication → Emails → Templates. _preview/ is only for looking:
 * images inlined, Supabase's variables filled with sample values, and a
 * "dark" copy of every light look with the dark-mode rules forced on.
 *
 * Images load from {{ .SiteURL }}/brand/email/ (drawn by _assets.mjs) and
 * {{ .SiteURL }}/brand/, so Authentication → URL Configuration → Site URL has
 * to be the public app address, without a trailing slash.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");

/* ---- Supabase's variables ------------------------------------------------ */
const URL = "{{ .ConfirmationURL }}";
const EMAIL = "{{ .Email }}";
const SITE = "{{ .SiteURL }}";
const IMG = `${SITE}/brand`;

/* ---- The app's palette (app/globals.css) --------------------------------- */
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

const D = {
  canvas: "#060607", card: "#141416", raised: "#1B1B1F", line: "#26262B",
  ink: "#ECECEE", body: "#AEAEB5", muted: "#8A8A93", link: "#8FC2FF", x: "#2E7BC4",
};
const L = {
  canvas: "#ECEEF2", card: "#FFFFFF", raised: "#F0F4F9", line: "#E1E4EA",
  ink: "#111318", body: "#3D414A", muted: "#5A5F6B", link: "#154E80", x: "#154E80", name: "#0B1B3F",
};
// The two strokes of the mark: the Consultant's blue and the Coach's violet.
const STROKE_A = "#2E7BC4";
const STROKE_B = "#8F7BE6";

/* ---- Copy ---------------------------------------------------------------- */
const COPY = {
  confirm: {
    file: "confirm-signup",
    template: "Confirm signup",
    subject: "Confirm your AgentiX Projects account",
    preheader: "One click and your account is ready.",
    h1: "Confirm your email",
    button: "Confirm email",
    ignore: "Didn't sign up for AgentiX? Ignore this email. Nothing happens until the link is used.",
  },
  reset: {
    file: "reset-password",
    template: "Reset password",
    subject: "Reset your AgentiX Projects password",
    preheader: "Choose a new password. The link works once.",
    h1: "Reset your password",
    button: "Choose a new password",
    ignore: "Didn't ask for this? Ignore this email. Your password stays as it is.",
  },
};

/* ---- Pieces every look shares -------------------------------------------- */

const css = {
  h1: (c, size = 30, lh = 36) =>
    `margin:0;font-family:${SANS};font-size:${size}px;line-height:${lh}px;font-weight:700;letter-spacing:-0.6px;color:${c};`,
  body: c => `margin:0;font-family:${SANS};font-size:16px;line-height:26px;color:${c};`,
  small: c => `margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${c};`,
  micro: c => `margin:0;font-family:${SANS};font-size:12px;line-height:18px;color:${c};`,
  label: c => `font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${c};`,
};

/** The address, set apart from the sentence around it. */
const addr = (c, cls = "") =>
  `<span class="${cls}" style="color:${c};font-weight:600;word-break:break-word;overflow-wrap:anywhere;">${EMAIL}</span>`;

/** Mark + "AgentiX / PROJECTS", the header lockup of the app. */
function lockup(p, { size = 32, cls = {}, align = "" } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${align ? ` align="${align}"` : ""}><tr>
<td valign="middle" style="padding-right:10px;"><img src="${IMG}/email/mark.png" width="${size}" height="${size}" alt="" style="display:block;border:0;outline:none;width:${size}px;height:${size}px;"></td>
<td valign="middle" style="font-family:${SANS};">
<div class="${cls.ink ?? ""}" style="font-size:17px;line-height:17px;font-weight:700;letter-spacing:-0.3px;color:${p.name ?? p.ink};">Agenti<span class="${cls.x ?? ""}" style="color:${p.x};">X</span></div>
<div class="${cls.muted ?? ""}" style="font-size:8px;line-height:8px;font-weight:700;letter-spacing:2.75px;color:${p.muted};padding-top:5px;">PROJECTS</div>
</td></tr></table>`;
}

/**
 * The button. Dark looks use the app's dark --primary-grad with dark ink, light
 * looks the light one with white. Outlook on Windows draws no gradient, so the
 * cell's bgcolor is a flat colour with the same contrast.
 */
function button(label, theme, { full = false, pill = false } = {}) {
  const r = pill ? 999 : 8;
  const s = theme === "dark"
    ? { bg: "#6BA3DB", grad: "linear-gradient(140deg,#A7C8E6 0%,#2E7BC4 100%)", ink: "#061018" }
    : { bg: "#154E80", grad: "linear-gradient(140deg,#2367A5 0%,#154E80 100%)", ink: "#FFFFFF" };
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${full ? ' width="100%"' : ""} class="${full ? "" : "btn"}" style="border-collapse:separate;">
<tr><td align="center" bgcolor="${s.bg}" style="border-radius:${r}px;background-color:${s.bg};background-image:${s.grad};mso-padding-alt:14px 28px;">
<a href="${URL}" target="_blank" style="display:${full ? "block" : "inline-block"};padding:14px 28px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:600;color:${s.ink};text-decoration:none;border-radius:${r}px;">${label}</a>
</td></tr></table>`;
}

/** "Button not working?" and the raw link. */
function fallback(p, cls = {}) {
  return `<p class="${cls.muted ?? ""}" style="${css.small(p.muted)}">Button not working? Paste this link into your browser:</p>
<p style="margin:0;padding-top:6px;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all;"><a href="${URL}" target="_blank" class="${cls.link ?? ""}" style="color:${p.link};text-decoration:none;">${URL}</a></p>`;
}

/** Company line and the two legal links, under every email. */
function legal(p, cls = "", align = "left") {
  const a = `color:${p.muted};text-decoration:underline;`;
  return `<p class="${cls}" style="${css.micro(p.muted)}text-align:${align};">XoXoCom UG (haftungsbeschränkt) · Hauptstraße 44 · 40789&nbsp;Monheim&nbsp;am&nbsp;Rhein</p>
<p class="${cls}" style="${css.micro(p.muted)}text-align:${align};padding-top:4px;"><a href="${SITE}/impressum" target="_blank" class="${cls}" style="${a}">Impressum</a> &nbsp;·&nbsp; <a href="${SITE}/datenschutz" target="_blank" class="${cls}" style="${a}">Datenschutz</a></p>`;
}

/** A 1px rule as a table, because <hr> is styled differently by every client. */
const rule = (c, cls = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="${cls}" style="border-top:1px solid ${c};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;

/**
 * The page around a look. `dark` lists the dark-mode overrides of a light look
 * (Apple Mail, iOS Mail, Outlook for Mac follow prefers-color-scheme;
 * Outlook.com tags what it recolours with data-ogsc / data-ogsb).
 */
function page({ copy, canvas, look, content, darkMode = false }) {
  const dm = darkMode ? `
<style>
@media (prefers-color-scheme:dark){
  .dm-canvas{background:${D.canvas}!important;background-color:${D.canvas}!important}
  .dm-card{background:${D.card}!important;background-color:${D.card}!important}
  .dm-raised{background:${D.raised}!important;background-color:${D.raised}!important}
  .dm-ink{color:${D.ink}!important}
  .dm-body{color:${D.body}!important}
  .dm-muted{color:${D.muted}!important}
  .dm-link{color:${D.link}!important}
  .dm-x{color:${D.x}!important}
  .dm-line{border-color:${D.line}!important}
}
</style>
<style>
[data-ogsc] .dm-ink{color:${D.ink}!important}
[data-ogsc] .dm-body{color:${D.body}!important}
[data-ogsc] .dm-muted{color:${D.muted}!important}
[data-ogsc] .dm-link{color:${D.link}!important}
[data-ogsb] .dm-canvas{background-color:${D.canvas}!important}
[data-ogsb] .dm-card{background-color:${D.card}!important}
[data-ogsb] .dm-raised{background-color:${D.raised}!important}
</style>` : "";

  return `<!--
  ${look} · Supabase → Authentication → Emails → Templates → "${copy.template}".
  Subject: ${copy.subject}

  Variables: .ConfirmationURL, .Email, .SiteURL. Images load from
  <Site URL>/brand/, so the Site URL (Authentication → URL Configuration) must be
  the public app address. The Supabase project is shared with the older app
  (MatFit): pasting this changes the email for every account in the project.
  Built by _build.mjs in this folder; edit there, not here.
-->
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${copy.subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
img{-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font:inherit!important}
@media only screen and (max-width:600px){
  .gutter{padding-left:12px!important;padding-right:12px!important}
  .px{padding-left:24px!important;padding-right:24px!important}
  .h1{font-size:26px!important;line-height:32px!important}
  .btn{width:100%!important}
  .btn a{display:block!important}
  .full{width:100%!important;height:auto!important}
  .stack{display:block!important;width:100%!important}
}
</style>${dm}
</head>
<body class="dm-canvas" style="margin:0;padding:0;background:${canvas};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${canvas};opacity:0;">${copy.preheader}${"&#8199;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${canvas}" class="dm-canvas" style="background:${canvas};">
<tr><td align="center" class="gutter" style="padding:40px 16px 48px;">
<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<div style="max-width:560px;margin:0 auto;text-align:left;">
${content}
</div>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`;
}

/* ===========================================================================
 * 1 · Orbit — dark. The app's own illustration (/brand/core.jpg, the two agents
 * on one orbit) as the hero, then what happens next.
 * ======================================================================== */
function orbit(k) {
  const c = COPY[k], p = D;
  const lead = k === "confirm"
    ? `Thanks for signing up. Confirm ${addr(p.ink)} and your account is ready.`
    : `Someone asked to reset the password for ${addr(p.ink)}. Choose a new one with the button below.`;
  const listTitle = k === "confirm" ? "What happens next" : "Good to know";
  const items = k === "confirm"
    ? ["Confirm this address.", "Enter the key from your invitation.", "Choose your Consultant and your Coach, and start a project."]
    : [
        "The link works once. If it has expired, ask for a new one on the sign&#8209;in page.",
        "Your current password keeps working until you choose a new one.",
        "Your projects and agents stay exactly as they are.",
      ];
  const rows = items.map((t, i) => `<tr>
<td valign="top" width="36" style="padding:12px 0;${i ? `border-top:1px solid ${p.line};` : ""}font-family:${MONO};font-size:12px;line-height:22px;color:${i === 0 && k === "confirm" ? p.link : p.muted};">${k === "confirm" ? `0${i + 1}` : "—"}</td>
<td valign="top" style="padding:12px 0;${i ? `border-top:1px solid ${p.line};` : ""}font-family:${SANS};font-size:14px;line-height:22px;color:${i === 0 && k === "confirm" ? p.ink : p.body};">${t}</td>
</tr>`).join("");

  return page({
    copy: c, canvas: p.canvas, look: "Variant 1 of 5, Orbit",
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 4px 20px;">${lockup(p, { size: 30 })}</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.card}" style="background:${p.card};border:1px solid ${p.line};border-radius:16px;border-collapse:separate;">
<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${IMG}/email/orbit.jpg" width="558" alt="" class="full" style="display:block;width:100%;max-width:558px;height:auto;border:0;border-radius:15px 15px 0 0;"></td></tr>
<tr><td class="px" style="padding:4px 40px 0;">
<h1 class="h1" style="${css.h1(p.ink)}">${c.h1}</h1>
<p style="${css.body(p.body)}padding-top:12px;">${lead}</p>
</td></tr>
<tr><td class="px" style="padding:28px 40px 0;">${button(c.button, "dark")}</td></tr>
<tr><td class="px" style="padding:36px 40px 0;">
<p style="${css.label(p.muted)}margin:0;padding-bottom:4px;">${listTitle}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
</td></tr>
<tr><td class="px" style="padding:24px 40px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.raised}" style="background:${p.raised};border-radius:10px;border-collapse:separate;"><tr><td style="padding:16px 18px;">
${fallback(p)}
</td></tr></table>
<p style="${css.small(p.muted)}padding-top:20px;">${c.ignore}</p>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:24px 40px 0;">
${legal(p)}
</td></tr></table>`,
  });
}

/* ===========================================================================
 * 2 · Duo — light. The two mascots, side by side as on the sign-in page,
 * each with the one line that says what it does.
 * ======================================================================== */
function duo(k) {
  const c = COPY[k], p = L;
  const h1 = k === "confirm" ? "Confirm your email" : "Choose a new password";
  const lead = k === "confirm"
    ? `Confirm ${addr(p.ink, "dm-ink")} and your account is ready. Then enter the key from your invitation, and your Consultant and your Coach can start on your first project.`
    : `Someone asked to reset the password for ${addr(p.ink, "dm-ink")}. Your projects and both agents are where you left them. Choose a new password to get back to them.`;
  const agent = (img, name, line) => `<td width="50%" align="center" valign="top" style="padding:26px 10px 22px;">
<img src="${IMG}/${img}.png" width="80" height="83" alt="" style="display:block;margin:0 auto;border:0;width:80px;height:83px;">
<p class="dm-ink" style="margin:0;padding-top:12px;font-family:${SANS};font-size:15px;line-height:20px;font-weight:700;color:${p.ink};">${name}</p>
<p class="dm-muted" style="margin:0;padding-top:4px;font-family:${SANS};font-size:13px;line-height:18px;color:${p.muted};">${line}</p>
</td>`;

  return page({
    copy: c, canvas: p.canvas, look: "Variant 2 of 5, Duo", darkMode: true,
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.card}" class="dm-card dm-line" style="background:${p.card};border:1px solid ${p.line};border-radius:16px;border-collapse:separate;">
<tr><td class="px" style="padding:32px 40px 0;">${lockup(p, { size: 30, cls: { ink: "dm-ink", x: "dm-x", muted: "dm-muted" } })}</td></tr>
<tr><td class="px" style="padding:28px 40px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.raised}" class="dm-raised" style="background:${p.raised};border-radius:12px;border-collapse:separate;"><tr>
${agent("consultant", "Consultant", "Works out what to change, and&nbsp;how")}
${agent("coach", "Coach", "Takes care of the people side")}
</tr></table>
</td></tr>
<tr><td class="px" style="padding:32px 40px 0;">
<h1 class="h1 dm-ink" style="${css.h1(p.ink, 28, 34)}">${h1}</h1>
<p class="dm-body" style="${css.body(p.body)}padding-top:12px;">${lead}</p>
</td></tr>
<tr><td class="px" style="padding:28px 40px 0;">${button(c.button, "light")}</td></tr>
<tr><td class="px" style="padding:32px 40px 0;">${rule(p.line, "dm-line")}</td></tr>
<tr><td class="px" style="padding:24px 40px 36px;">
<p class="dm-muted" style="${css.small(p.muted)}">${c.ignore}</p>
<div style="padding-top:16px;">${fallback(p, { muted: "dm-muted", link: "dm-link" })}</div>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:24px 40px 0;">
${legal(p, "dm-muted")}
</td></tr></table>`,
  });
}

/* ===========================================================================
 * 3 · Quiet — light, no card, no picture. Typography and one button; the
 * look of a well-set letter. Loads one 32px image, so it survives images-off.
 * ======================================================================== */
function quiet(k) {
  const c = COPY[k], p = L;
  const lead = k === "confirm"
    ? `Thanks for signing up. Confirm ${addr(p.ink, "dm-ink")} and your account is ready. Then enter the key from your invitation to start your first project.`
    : `Someone asked to reset the password for ${addr(p.ink, "dm-ink")}. Choose a new one with the button below. The link works once.`;

  return page({
    copy: c, canvas: p.card, look: "Variant 3 of 5, Quiet", darkMode: true,
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="px" style="padding:8px 24px 0;">${lockup(p, { size: 32, cls: { ink: "dm-ink", x: "dm-x", muted: "dm-muted" } })}</td></tr>
<tr><td class="px" style="padding:56px 24px 0;">
<h1 class="h1 dm-ink" style="${css.h1(p.ink, 34, 40)}letter-spacing:-0.9px;">${c.h1}</h1>
<p class="dm-body" style="${css.body(p.body)}padding-top:16px;font-size:17px;line-height:28px;">${lead}</p>
</td></tr>
<tr><td class="px" style="padding:32px 24px 0;">${button(c.button, "light")}</td></tr>
<tr><td class="px" style="padding:56px 24px 0;">${rule(p.line, "dm-line")}</td></tr>
<tr><td class="px" style="padding:24px 24px 0;">
<p class="dm-muted" style="${css.small(p.muted)}">${c.ignore}</p>
<div style="padding-top:16px;">${fallback(p, { muted: "dm-muted", link: "dm-link" })}</div>
</td></tr>
<tr><td class="px" style="padding:40px 24px 0;">
${legal(p, "dm-muted")}
</td></tr>
</table>`,
  });
}

/* ===========================================================================
 * 4 · Signal — dark, structured. The mark's two strokes as the top edge, and
 * the facts of the request in a table, set in the app's mono for labels.
 * ======================================================================== */
function signal(k) {
  const c = COPY[k], p = D;
  const tag = k === "confirm" ? "New account" : "Password reset";
  const lead = k === "confirm"
    ? "Thanks for signing up. One click confirms this address, and your account is ready."
    : "We got a request to reset the password for this account. Choose a new one with the button below.";
  const facts = k === "confirm"
    ? [["Address", EMAIL], ["Next", "Enter the key from your invitation"], ["Link", "Works once"]]
    : [["Account", EMAIL], ["Link", "Works once"], ["Until then", "Your current password keeps working"]];
  const rows = facts.map(([l, v], i) => `<tr>
<td valign="top" width="104" style="padding:13px 0 13px 18px;${i ? `border-top:1px solid ${p.line};` : ""}${css.label(p.muted)}line-height:20px;">${l}</td>
<td valign="top" style="padding:13px 18px 13px 8px;${i ? `border-top:1px solid ${p.line};` : ""}font-family:${SANS};font-size:14px;line-height:20px;color:${p.ink};word-break:break-word;">${v}</td>
</tr>`).join("");

  return page({
    copy: c, canvas: p.canvas, look: "Variant 4 of 5, Signal",
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.card}" style="background:${p.card};border:1px solid ${p.line};border-radius:12px;border-collapse:separate;overflow:hidden;">
<tr><td style="padding:0;font-size:0;line-height:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="50%" height="3" bgcolor="${STROKE_A}" style="height:3px;background:${STROKE_A};font-size:0;line-height:0;border-radius:11px 0 0 0;">&nbsp;</td>
<td width="50%" height="3" bgcolor="${STROKE_B}" style="height:3px;background:${STROKE_B};font-size:0;line-height:0;border-radius:0 11px 0 0;">&nbsp;</td>
</tr></table>
</td></tr>
<tr><td class="px" style="padding:22px 32px 22px;border-bottom:1px solid ${p.line};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle">${lockup(p, { size: 28 })}</td>
<td valign="middle" align="right" style="${css.label(p.muted)}">${tag}</td>
</tr></table>
</td></tr>
<tr><td class="px" style="padding:36px 32px 0;">
<h1 class="h1" style="${css.h1(p.ink, 28, 34)}">${c.h1}</h1>
<p style="${css.body(p.body)}padding-top:12px;">${lead}</p>
</td></tr>
<tr><td class="px" style="padding:24px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.raised}" style="background:${p.raised};border:1px solid ${p.line};border-radius:10px;border-collapse:separate;">${rows}</table>
</td></tr>
<tr><td class="px" style="padding:28px 32px 0;">${button(c.button, "dark")}</td></tr>
<tr><td class="px" style="padding:32px 32px 32px;">
${rule(p.line)}
<p style="${css.small(p.muted)}padding-top:20px;">${c.ignore}</p>
<div style="padding-top:16px;">${fallback(p)}</div>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" style="padding:24px 32px 0;">
${legal(p)}
</td></tr></table>`,
  });
}

/* ===========================================================================
 * 5 · Horizon — the night sky of the app on top (the mark on the agents'
 * orbit, drawn for this email), a light page underneath to read and act on.
 * ======================================================================== */
function horizon(k) {
  const c = COPY[k], p = L, NIGHT = "#0B0C11";
  // The dashboard's headline: the second line in the agents' light blue.
  const h1 = k === "confirm"
    ? `Two agents.<br><span style="color:#A9BEF2;">One project.</span>`
    : "Reset your password";
  const sub = k === "confirm"
    ? "Confirm your email, and your account is ready."
    : `For ${addr("#ECECEE")}`;
  const lead = k === "confirm"
    ? `Confirm ${addr(p.ink, "dm-ink")} with the button below. Then enter the key from your invitation, choose your Consultant and your Coach, and start your first project.`
    : "Choose a new password with the button below. The link works once. Your projects and agents stay exactly as they are.";

  return page({
    copy: c, canvas: p.canvas, look: "Variant 5 of 5, Horizon", darkMode: true,
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.card}" class="dm-card" style="background:${p.card};border-radius:16px;border-collapse:separate;">
<tr><td bgcolor="${NIGHT}" style="padding:0;font-size:0;line-height:0;background:${NIGHT};border-radius:16px 16px 0 0;"><img src="${IMG}/email/horizon.png" width="560" alt="AgentiX Projects" class="full" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:16px 16px 0 0;color:#ECECEE;font-family:${SANS};font-size:14px;line-height:20px;"></td></tr>
<tr><td align="center" bgcolor="${NIGHT}" class="px" style="padding:0 40px 40px;background:${NIGHT};text-align:center;">
<p style="margin:0;padding-bottom:14px;font-family:${MONO};font-size:11px;line-height:16px;letter-spacing:4px;text-transform:uppercase;color:${D.muted};text-align:center;">AgentiX Projects</p>
<h1 class="h1" style="${css.h1("#FFFFFF", 30, 36)}text-align:center;">${h1}</h1>
<p style="${css.body(D.body)}padding-top:10px;font-size:15px;line-height:24px;text-align:center;">${sub}</p>
</td></tr>
<tr><td class="px" style="padding:36px 40px 0;">
<p class="dm-body" style="${css.body(p.body)}">${lead}</p>
</td></tr>
<tr><td class="px" style="padding:28px 40px 0;">${button(c.button, "light", { pill: true })}</td></tr>
<tr><td class="px" style="padding:32px 40px 36px;">
${rule(p.line, "dm-line")}
<p class="dm-muted" style="${css.small(p.muted)}padding-top:20px;">${c.ignore}</p>
<div style="padding-top:16px;">${fallback(p, { muted: "dm-muted", link: "dm-link" })}</div>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:28px 24px 12px;">${lockup(p, { size: 24, align: "center", cls: { ink: "dm-ink", x: "dm-x", muted: "dm-muted" } })}</td></tr>
<tr><td class="px" style="padding:0 24px;">${legal(p, "dm-muted", "center")}</td></tr>
</table>`,
  });
}

/* ===========================================================================
 * 6 · Horizon + Orbit (Ana, 2026-11-03): Horizon's picture and light page,
 * Signal's two-stroke top edge, Orbit's text and button on the night under
 * the picture, and Orbit's list on the light page.
 * ======================================================================== */
function horizonOrbit(k) {
  const c = COPY[k], p = L, NIGHT = "#0B0C11";
  const lead = k === "confirm"
    ? `Thanks for signing up. Confirm ${addr(D.ink)} and your account is ready.`
    : `Someone asked to reset the password for ${addr(D.ink)}. Choose a new one with the button below.`;
  const listTitle = k === "confirm" ? "What happens next" : "Good to know";
  const items = k === "confirm"
    ? ["Confirm this address.", "Enter the key from your invitation.", "Choose your Consultant and your Coach, and start a project."]
    : [
        "The link works once. If it has expired, ask for a new one on the sign&#8209;in page.",
        "Your current password keeps working until you choose a new one.",
        "Your projects and agents stay exactly as they are.",
      ];
  const first = i => i === 0 && k === "confirm";
  const rows = items.map((t, i) => `<tr>
<td valign="top" width="36" class="${i ? "dm-line " : ""}${first(i) ? "dm-link" : "dm-muted"}" style="padding:12px 0;${i ? `border-top:1px solid ${p.line};` : ""}font-family:${MONO};font-size:12px;line-height:22px;color:${first(i) ? p.link : p.muted};">${k === "confirm" ? `0${i + 1}` : "—"}</td>
<td valign="top" class="${i ? "dm-line " : ""}${first(i) ? "dm-ink" : "dm-body"}" style="padding:12px 0;${i ? `border-top:1px solid ${p.line};` : ""}font-family:${SANS};font-size:14px;line-height:22px;color:${first(i) ? p.ink : p.body};">${t}</td>
</tr>`).join("");

  return page({
    copy: c, canvas: p.canvas, look: "Variant 6, Horizon + Signal's edge + Orbit's text", darkMode: true,
    content: `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${p.card}" class="dm-card" style="background:${p.card};border-radius:16px;border-collapse:separate;">
<tr><td style="padding:0;font-size:0;line-height:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="50%" height="3" bgcolor="${STROKE_A}" style="height:3px;background:${STROKE_A};font-size:0;line-height:0;border-radius:16px 0 0 0;">&nbsp;</td>
<td width="50%" height="3" bgcolor="${STROKE_B}" style="height:3px;background:${STROKE_B};font-size:0;line-height:0;border-radius:0 16px 0 0;">&nbsp;</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${NIGHT}" style="padding:0;font-size:0;line-height:0;background:${NIGHT};"><img src="${IMG}/email/horizon.png" width="560" alt="AgentiX Projects" class="full" style="display:block;width:100%;max-width:560px;height:auto;border:0;color:#ECECEE;font-family:${SANS};font-size:14px;line-height:20px;"></td></tr>
<tr><td bgcolor="${NIGHT}" class="px" style="padding:4px 40px 40px;background:${NIGHT};">
<h1 class="h1" style="${css.h1(D.ink)}">${c.h1}</h1>
<p style="${css.body(D.body)}padding-top:12px;">${lead}</p>
<div style="padding-top:28px;">${button(c.button, "dark")}</div>
</td></tr>
<tr><td class="px" style="padding:32px 40px 0;">
<p class="dm-muted" style="${css.label(p.muted)}margin:0;padding-bottom:4px;">${listTitle}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
</td></tr>
<tr><td class="px" style="padding:24px 40px 36px;">
${rule(p.line, "dm-line")}
<p class="dm-muted" style="${css.small(p.muted)}padding-top:20px;">${c.ignore}</p>
<div style="padding-top:16px;">${fallback(p, { muted: "dm-muted", link: "dm-link" })}</div>
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:28px 24px 12px;">${lockup(p, { size: 24, align: "center", cls: { ink: "dm-ink", x: "dm-x", muted: "dm-muted" } })}</td></tr>
<tr><td class="px" style="padding:0 24px;">${legal(p, "dm-muted", "center")}</td></tr>
</table>`,
  });
}

/* ---- Write ---------------------------------------------------------------- */

const LOOKS = [
  { id: "1-orbit", fn: orbit, light: false, note: "Dark. The app's orbit illustration as the hero, then what happens next." },
  { id: "2-duo", fn: duo, light: true, note: "Light. Consultant and Coach side by side, each with what it does." },
  { id: "3-quiet", fn: quiet, light: true, note: "Light, no card, no picture. Type and one button; survives images-off." },
  { id: "4-signal", fn: signal, light: false, note: "Dark and structured. The mark's two strokes as the top edge, the request as a table." },
  { id: "5-horizon", fn: horizon, light: true, note: "Night-sky header drawn for the email (mark on the agents' orbit), light page below." },
  // Its own folder, as confirm-signup.html / reset-password.html, so the pair is easy to find.
  { id: "6-horizon-orbit", fn: horizonOrbit, light: true, dir: "6-horizon-orbit", note: "Horizon's picture and light page, Signal's two-stroke edge, Orbit's text and button." },
];

const SAMPLE = {
  [EMAIL]: "lena.hoffmann@company.de",
  [SITE]: "https://agentix.example",
};

const dataUri = rel => {
  const file = path.join(root, "public", rel);
  const mime = rel.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${readFileSync(file).toString("base64")}`;
};

function preview(html, forceDark, kind) {
  const type = kind === "reset" ? "recovery" : "signup";
  html = html.split(URL).join(`https://abcdefghijklmnop.supabase.co/auth/v1/verify?token=pkce_8f2a61c4d09b7a35af2c8d4b19e0&type=${type}&redirect_to=https://agentix.example/${kind === "reset" ? "reset" : "dashboard"}`);
  let out = html.replace(/\{\{ \.SiteURL \}\}\/(brand\/[\w./-]+)/g, (_, rel) => dataUri(rel));
  for (const [k, v] of Object.entries(SAMPLE)) out = out.split(k).join(v);
  if (forceDark) out = out.replace("@media (prefers-color-scheme:dark)", "@media all");
  return out;
}

const prevDir = path.join(here, "_preview");
rmSync(prevDir, { recursive: true, force: true });
mkdirSync(prevDir, { recursive: true });

const gallery = [];
for (const look of LOOKS) {
  const shots = [];
  for (const k of ["confirm", "reset"]) {
    const name = `${COPY[k].file}.${look.id}`;
    const html = look.fn(k);
    if (look.dir) {
      mkdirSync(path.join(here, look.dir), { recursive: true });
      writeFileSync(path.join(here, look.dir, `${COPY[k].file}.html`), html);
    } else {
      writeFileSync(path.join(here, `${name}.html`), html);
    }
    writeFileSync(path.join(prevDir, `${name}.html`), preview(html, false, k));
    shots.push({ label: COPY[k].template, html: preview(html, false, k), w: 620 });
    if (look.light) {
      writeFileSync(path.join(prevDir, `${name}.dark.html`), preview(html, true, k));
    }
  }
  const confirm = look.fn("confirm");
  shots.push({ label: "Phone", html: preview(confirm, false, "confirm"), w: 375 });
  if (look.light) shots.push({ label: "Dark mode (Apple Mail)", html: preview(confirm, true, "confirm"), w: 620 });
  gallery.push({ look, shots });
}

const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
writeFileSync(path.join(prevDir, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AgentiX email variants</title>
<style>
body{margin:0;padding:32px;background:#d5d8df;color:#111318;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-0.3px} .intro{color:#5A5F6B;margin:0 0 32px}
section{margin-bottom:48px} h2{font-size:17px;margin:0} h2 + p{margin:2px 0 14px;color:#5A5F6B}
.row{display:flex;gap:20px;align-items:flex-start;overflow-x:auto;padding-bottom:12px}
figure{margin:0;flex:none} figcaption{font:600 11px ui-monospace,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em;color:#5A5F6B;margin-bottom:8px}
iframe{border:0;border-radius:10px;background:#fff;display:block;box-shadow:0 1px 2px rgba(0,0,0,.08)}
</style></head><body>
<h1>AgentiX Projects · email variants</h1>
<p class="intro">${LOOKS.length} looks, each as "Confirm signup" and "Reset password". Sample values filled in; the files to paste are one folder up.</p>
${gallery.map(({ look, shots }) => `<section><h2>${look.id}</h2><p>${look.note}</p><div class="row">
${shots.map(s => `<figure><figcaption>${s.label}</figcaption><iframe width="${s.w}" height="900" scrolling="no" srcdoc="${esc(s.html)}" onload="this.style.height=this.contentDocument.documentElement.scrollHeight+'px'"></iframe></figure>`).join("\n")}
</div></section>`).join("\n")}
</body></html>`);

console.log(`wrote ${LOOKS.length * 2} templates and ${prevDir}`);
