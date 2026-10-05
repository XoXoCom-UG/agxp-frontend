import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
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
/*
 * The same three faces the marketing site uses (Space Grotesk / Inter /
 * JetBrains Mono), so the product and the page that sells it are visibly one
 * thing rather than two near-misses. Space Grotesk is loaded at 400-600
 * because the display weight here is 500, not 600 — the landing page sets
 * its huge headings at 500 and the extra weight is what made ours look
 * heavier than the brand.
 */
const sans = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], display: "swap", weight: ["400", "500"], variable: "--font-mono-face" });

/**
 * The origin that relative metadata URLs resolve against — the opengraph
 * image above all. Without it Next falls back to http://localhost:3000, so a
 * link shared from production carried a preview image nobody else could load.
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL on every deployment; the literal
 * is the fallback for a self-hosted build.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
