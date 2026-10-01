import { useId } from "react";

/**
 * The AgentiX mark (Ana, 2026-09-28 — the landing-page proposal, picked over
 * the ribbon "A"): a dark rounded tile with a four-point star cut across it,
 * white at the crossing and blue at the tips. One component so the header,
 * the auth pages and the legal footer can't drift apart.
 *
 * The geometry lives in one place, `MARK_PATHS`, because the same drawing has
 * to exist three times over — as React, as a raw SVG string for next/og, and
 * as app/icon.svg — and a mark that differs between the tab, the share card
 * and the header is three logos, not one.
 */
const STAR_D = "M20 5.5C20 20 20 20 34.5 20 20 20 20 20 20 34.5 20 20 20 20 5.5 20 20 20 20 20 20 5.5Z";

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
        <linearGradient id={`${id}-star`} x1="9" y1="9" x2="31" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8FC2FF" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#4F8FFF" />
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
      {/* Upright, then turned 45°: the four-point star reads as an X, which is
          the letter the name ends on. */}
      <path d={STAR_D} fill={`url(#${id}-star)`} transform="rotate(45 20 20)" />
      <circle cx="20" cy="20" r="2.1" fill="#FFFFFF" />
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
<linearGradient id="star" x1="9" y1="9" x2="31" y2="31" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8FC2FF"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#4F8FFF"/></linearGradient>
<radialGradient id="glow" cx="20" cy="20" r="13" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7FB4FF" stop-opacity="0.55"/><stop offset="1" stop-color="#7FB4FF" stop-opacity="0"/></radialGradient>
</defs>
<rect x="1" y="1" width="38" height="38" rx="12" fill="url(#tile)"/>
<rect x="1.6" y="1.6" width="36.8" height="36.8" rx="11.4" fill="none" stroke="rgba(150,185,255,0.30)" stroke-width="1.2"/>
<circle cx="20" cy="20" r="13" fill="url(#glow)"/>
<path d="${STAR_D}" fill="url(#star)" transform="rotate(45 20 20)"/>
<circle cx="20" cy="20" r="2.1" fill="#FFFFFF"/>
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
