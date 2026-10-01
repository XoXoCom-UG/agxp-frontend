// Icons copied path-for-path from Ana's mockup (agxp-functional-ui) so shapes
// match exactly, not just approximate Lucide equivalents. The geometry lives in
// lib/icon-paths.ts, shared with the HTML-string renderer in lib/markdown.ts.

import { ICON_PATHS, ICON_STROKE, type IconName } from "@/lib/icon-paths";

type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Only for an icon that carries meaning on its own. Without it the icon is
   *  decoration and hidden from assistive tech — the button's label speaks. */
  title?: string;
};

function Svg({ name, size = 14, className, style, title }: IconProps & { name: IconName }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined} aria-label={title}
      // Static path strings from ICON_PATHS, never user or model input.
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }} />
  );
}

const make = (name: IconName, extraClass?: string) => {
  const Icon = (p: IconProps) => (
    <Svg {...p} name={name} className={[extraClass, p.className].filter(Boolean).join(" ") || undefined} />
  );
  return Icon;
};

export const IconPlus = make("plus");
export const IconArrow = make("arrow", "arrow");
export const IconBack = make("back");
export const IconSearch = make("search");
export const IconFilter = make("filter");
export const IconChevronDown = make("chevronDown");
export const IconFolder = make("folder");
export const IconHistory = make("history");
export const IconClock = make("clock");
export const IconTrash = make("trash");
export const IconChart = make("chart");
export const IconMore = make("more");
export const IconUser = make("user");
export const IconLogout = make("logout");
export const IconSwap = make("swap");
export const IconSun = make("sun");
export const IconMoon = make("moon");
export const IconMonitor = make("monitor");
export const IconCheck = make("check");
export const IconX = make("x");
export const IconAlert = make("alert");

// --- Deliverable document view (Transformation Concept / Change Plan) ---
export const IconDoc = make("doc");
export const IconDownload = make("download");
export const IconPrint = make("print");
export const IconCopy = make("copy");
export const IconSpark = make("spark");
export const IconRefresh = make("refresh");
export const IconRestore = make("restore");

// --- Composer (agxp-frontend-ana) ---
export const IconAttach = make("attach");
export const IconArrowUp = make("arrowUp");
export const IconStop = make("stop");

// --- Folding the Coach away ---
export const IconMinimise = make("minimise");

// --- Under each answer: Copy / Share / Try again ---
export const IconShare = make("share");
export const IconMail = make("mail");

// --- Forms ---
export const IconEye = make("eye");
export const IconEyeOff = make("eyeOff");

// --- Agent Dashboard ---
export const IconMoreV = make("moreV");
export const IconArchive = make("archive");
