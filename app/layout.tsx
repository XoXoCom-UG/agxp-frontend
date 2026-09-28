import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import "./agxp-design.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { StaleBuildRecovery } from "@/components/layout/stale-build-recovery";
import { MascotDefs } from "@/components/layout/agent-mascot";
import { TooltipWarmth } from "@/components/layout/tooltip-warmth";

/**
 * Three typefaces, one job each, chosen for AgentiX rather than borrowed from
 * the default AI-SaaS stack (Ana, 2026-09-27):
 *
 *   Familjen Grotesk   names, headings, numbers: the things you look AT.
 *                      A Swedish grotesk with a distinct g and a; it gives the
 *                      agents a voice without turning into a novelty face.
 *   Schibsted Grotesk  everything you read THROUGH. Drawn for a newsroom, so
 *                      it holds up in long answers and in the documents.
 *   IBM Plex Mono      data only: station 8/8, percentages, code. Plex reads
 *                      as consulting, not as a terminal.
 *
 * Loaded through next/font, not a Google Fonts <link>: the CSP in
 * next.config.ts allows `font-src 'self'` only, and next/font self-hosts the
 * files, so this stays inside the policy instead of widening it.
 */
const sans = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-sans" });
const display = Familjen_Grotesk({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], display: "swap", weight: ["400", "500"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: {
    default: "AgentiX Projects · Train your AI project agents",
    template: "%s · AgentiX",
  },
  description:
    "Pair an AI consultant with an AI coach and talk to both about your transformation project. They ask the questions and produce the documents.",
  applicationName: "AgentiX Projects",
  robots: { index: false, follow: false }, // private app — keep out of search engines
  openGraph: {
    title: "AgentiX Projects · Train your AI project agents",
    description: "An AI consultant and an AI coach, working your project through with you.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#060607" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla's
          cz-shortcut-listen) inject attributes onto <body> before React
          hydrates — a real mismatch, but not one the app caused or can avoid. */}
      <body suppressHydrationWarning>
        {/* The mascots' shared gradients, once for the whole app. */}
        <MascotDefs />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <StaleBuildRecovery />
          <TooltipWarmth />
          <AuthProvider>{children}</AuthProvider>
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
