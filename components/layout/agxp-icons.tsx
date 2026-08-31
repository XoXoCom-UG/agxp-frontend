// Icons copied path-for-path from Ana's mockup (agxp-functional-ui) so shapes
// match exactly, not just approximate Lucide equivalents.

type IconProps = { size?: number; className?: string };

function Svg({ size = 14, className, children, strokeWidth = 1.8 }: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

export const IconDiamond = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" /></Svg>;
export const IconPlus = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconArrow = (p: IconProps) => <Svg {...p} strokeWidth={2.2} className={["arrow", p.className].filter(Boolean).join(" ")}><path d="M9 6l6 6-6 6" /></Svg>;
export const IconBack = (p: IconProps) => <Svg {...p} strokeWidth={2.2}><path d="M15 6l-6 6 6 6" /></Svg>;
export const IconSearch = (p: IconProps) => <Svg {...p} strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>;
export const IconFilter = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>;
export const IconBell = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
export const IconCoach = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></Svg>;
export const IconConsultant = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><rect x="4" y="8" width="16" height="11" rx="2" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Svg>;
export const IconChevronDown = (p: IconProps) => <Svg {...p} strokeWidth={2.2}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconFolder = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></Svg>;
export const IconHistory = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 3" /></Svg>;
export const IconUsers = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
export const IconMore = (p: IconProps) => <Svg {...p} strokeWidth={2}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Svg>;
export const IconUser = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Svg>;
export const IconLogout = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>;
export const IconSwap = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></Svg>;
export const IconSun = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
export const IconMoon = (p: IconProps) => <Svg {...p} strokeWidth={1.8}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></Svg>;
export const IconSend = (p: IconProps) => <Svg {...p} strokeWidth={2.2} className="send-icon"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></Svg>;
export const IconCheck = (p: IconProps) => <Svg {...p} strokeWidth={2.5}><path d="M20 6 9 17l-5-5" /></Svg>;
export const IconX = (p: IconProps) => <Svg {...p} strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
