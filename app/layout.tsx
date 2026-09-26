import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./agxp-design.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { StaleBuildRecovery } from "@/components/layout/stale-build-recovery";

/**
 * Three typefaces, one job each — the B mockup's whole voice is carried by
 * this split: Space Grotesk for names and numbers, Inter for anything you
 * actually read, JetBrains Mono for the small tracked-out labels.
 *
 * Loaded through next/font, not a Google Fonts <link>: the CSS in
 * next.config.ts allows `font-src 'self'` only, and next/font self-hosts the
 * files, so this stays inside the policy instead of widening it.
 */
const sans = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const display = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["400", "500", "600", "700"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", weight: ["400", "500"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: {
    default: "Agentix Projects — Train your AI Project-Agents",
    template: "%s · AgXP",
  },
  description:
    "Pair an AI consultant with an AI coach and talk to both about your transformation project. They ask the questions and produce the documents.",
  applicationName: "Agentix Projects",
  robots: { index: false, follow: false }, // private app — keep out of search engines
  openGraph: {
    title: "Agentix Projects — Train your AI Project-Agents",
    description: "An AI consultant and an AI coach, working your project through with you.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#06080D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <StaleBuildRecovery />
          <AuthProvider>{children}</AuthProvider>
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
