import { useId } from "react";

/**
 * The AgentiX mark.
 *
 * Ana's first mark (2026-09-28) was a four-point star cut across a dark tile,
 * turned 45° so it read as the X the name ends on. This keeps the tile and
 * keeps the X, and replaces the star with the thing the product actually is:
 * TWO strokes, one per agent, in the two role colours, crossing at a lit
 * core. The letter is still there, and now it also says what it stands for —
 * the same idea as /brand/core.jpg, where the two agents share one orbit.
 *
 * Two fat strokes also survive a favicon. The star had four thin points
 * meeting at a hairline, and at 16px that collapsed into a blob; a stroke
 * 5.6 units wide in a 40 unit box is still 2.2px there.
 *
 * The geometry lives in one place because the same drawing has to exist three
 * times over — as React, as a raw SVG string for next/og, and as
 * app/icon.svg — and a mark that differs between the tab, the share card and
 * the header is three logos, not one.
 */

/** The Consultant stroke: top-left down to bottom-right. */
export const MARK_A = "M12.4 12.4 L27.6 27.6";
/** The Coach stroke, the other way, so the two make the X. */
export const MARK_B = "M27.6 12.4 L12.4 27.6";
const MARK_W = 5.6;

export function BrandMark({ size = 30 }: { size?: number }) {
  // Several logos on one page (header + a dialog) must not share gradient ids.
  const id = useId().replace(/:/g, "");
  return (
    <svg className="brand-logo-mark" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-tile`} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#242A38" />
          <stop offset="1" stopColor="#0B0D14" />
        </linearGradient>
        <linearGradient id={`${id}-a`} x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8FC2FF" /><stop offset="1" stopColor="#2E7BC4" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="28" y1="12" x2="12" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C3AEFF" /><stop offset="1" stopColor="#6D5BD0" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="20" cy="20" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7FB4FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7FB4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="12" fill={`url(#${id}-tile)`} />
      <rect x="1.6" y="1.6" width="36.8" height="36.8" rx="11.4" fill="none"
        stroke="rgba(150,185,255,0.30)" strokeWidth="1.2" />
      <circle cx="20" cy="20" r="13" fill={`url(#${id}-glow)`} />
      {/* One stroke per agent, crossing: the X of the name, and the two of
          them meeting on one project. */}
      <path d={MARK_A} stroke={`url(#${id}-a)`} strokeWidth={MARK_W} strokeLinecap="round" />
      <path d={MARK_B} stroke={`url(#${id}-b)`} strokeWidth={MARK_W} strokeLinecap="round" />
      {/* The core sits on top of the crossing, so neither stroke is the one
          that happens to be painted second. */}
      <circle cx="20" cy="20" r="3.1" fill="#0B0D14" />
      <circle cx="20" cy="20" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * The same mark as a standalone SVG string, for the places React can't render
 * into: the generated apple-icon and the Open Graph image, which both go
 * through next/og. app/icon.svg is a copy of it. Change the geometry and all
 * three have to move together.
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
<defs>
<linearGradient id="tile" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#242A38"/><stop offset="1" stop-color="#0B0D14"/></linearGradient>
<linearGradient id="a" x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8FC2FF"/><stop offset="1" stop-color="#2E7BC4"/></linearGradient>
<linearGradient id="b" x1="28" y1="12" x2="12" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#C3AEFF"/><stop offset="1" stop-color="#6D5BD0"/></linearGradient>
<radialGradient id="glow" cx="20" cy="20" r="13" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7FB4FF" stop-opacity="0.55"/><stop offset="1" stop-color="#7FB4FF" stop-opacity="0"/></radialGradient>
</defs>
<rect x="1" y="1" width="38" height="38" rx="12" fill="url(#tile)"/>
<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="11.4" fill="none" stroke="rgba(150,185,255,0.30)" stroke-width="1.2"/>
<circle cx="20" cy="20" r="13" fill="url(#glow)"/>
<path d="${MARK_A}" stroke="url(#a)" stroke-width="${MARK_W}" stroke-linecap="round"/>
<path d="${MARK_B}" stroke="url(#b)" stroke-width="${MARK_W}" stroke-linecap="round"/>
<circle cx="20" cy="20" r="3.1" fill="#0B0D14"/>
<circle cx="20" cy="20" r="2.2" fill="#FFFFFF"/>
</svg>`;

/**
 * Mark plus word mark: "AgentiX" with the X in the accent blue, and PROJECTS
 * underneath, set to exactly the width of the name above it.
 *
 * That fit is done by the layout, not by a letter-spacing value someone
 * eyeballed: the letters are flex items with `space-between`, so they spread
 * to whatever width the name happens to be. A hand-picked tracking only lines
 * up at one font size, in one browser, until someone changes the name.
 *
 * The letters are hidden from assistive tech and the word is carried by the
 * visually-hidden span beside them — read letter by letter, "P R O J E C T S"
 * is not the product's name.
 */
export function BrandLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-logo">
      <BrandMark size={size} />
      <span className="brand-logo-text">
        <span className="name">Agenti<span className="x">X</span></span>
        <span className="sub">
          <span className="visually-hidden">Projects</span>
          <span className="sub-fit" aria-hidden="true">
            {[..."PROJECTS"].map((c, i) => <i key={i}>{c}</i>)}
          </span>
        </span>
      </span>
    </span>
  );
}
