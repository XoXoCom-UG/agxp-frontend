import { useId } from "react";

/**
 * The AgentiX mark: an "A" of two soft ribbons, blue into violet into pink,
 * with a lit fold where they cross — and the word mark, AgentiX over PROJECTS.
 * One component so the header and the auth pages can't drift apart.
 */
export function BrandMark({ size = 30 }: { size?: number }) {
  // Several logos on one page (header + a dialog) must not share gradient ids.
  const id = useId().replace(/:/g, "");
  return (
    <svg className="brand-logo-mark" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-l`} x1="8" y1="36" x2="22" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5E7CFF" />
          <stop offset="0.55" stopColor="#8F92FF" />
          <stop offset="1" stopColor="#C3B4FF" />
        </linearGradient>
        <linearGradient id={`${id}-r`} x1="20" y1="4" x2="33" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#B8A6FF" />
          <stop offset="0.6" stopColor="#D6B4F4" />
          <stop offset="1" stopColor="#F2C9E8" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="14" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-g`} cx="20" cy="36" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8C7BFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8C7BFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="35" rx="15" ry="5" fill={`url(#${id}-g)`} />
      {/* right leg first, so the left one folds over it at the apex */}
      <path d="M20.2 7.2 L30.6 32.4" stroke={`url(#${id}-r)`} strokeWidth="7.4" strokeLinecap="round" />
      <path d="M9.4 32.4 L19.8 7.2" stroke={`url(#${id}-l)`} strokeWidth="7.4" strokeLinecap="round" />
      <path d="M13.2 24.6 L19.2 9.6" stroke={`url(#${id}-s)`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The same mark as a standalone SVG string, for the places React can't render
 * into: the generated apple-icon and the Open Graph image, which both go
 * through next/og. app/icon.svg is a copy of it on a dark tile. Change the
 * geometry and all three have to move together.
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
<defs>
<linearGradient id="l" x1="8" y1="36" x2="22" y2="4" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5E7CFF"/><stop offset="0.55" stop-color="#8F92FF"/><stop offset="1" stop-color="#C3B4FF"/></linearGradient>
<linearGradient id="r" x1="20" y1="4" x2="33" y2="36" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#B8A6FF"/><stop offset="0.6" stop-color="#D6B4F4"/><stop offset="1" stop-color="#F2C9E8"/></linearGradient>
<linearGradient id="s" x1="14" y1="10" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
<radialGradient id="g" cx="20" cy="36" r="14" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#8C7BFF" stop-opacity="0.55"/><stop offset="1" stop-color="#8C7BFF" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="20" cy="35" rx="15" ry="5" fill="url(#g)"/>
<path d="M20.2 7.2 L30.6 32.4" stroke="url(#r)" stroke-width="7.4" stroke-linecap="round"/>
<path d="M9.4 32.4 L19.8 7.2" stroke="url(#l)" stroke-width="7.4" stroke-linecap="round"/>
<path d="M13.2 24.6 L19.2 9.6" stroke="url(#s)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function BrandLogo({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-logo">
      <BrandMark size={size} />
      <span className="brand-logo-text">
        <span className="name">Agenti<span className="x">X</span></span>
        <span className="sub">Projects</span>
      </span>
    </span>
  );
}
