import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./agxp-design.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { StaleBuildRecovery } from "@/components/layout/stale-build-recovery";

export const metadata: Metadata = {
  title: {
    default: "AgentiX Projects",
    template: "%s · AgentiX Projects",
  },
  description:
    "Train your AI Project-Agents: Coach und Consultant arbeiten gleichzeitig an deinem IT-Projekt — Ist-Analyse, Anforderungen und Roadmap KI-gestützt.",
  applicationName: "AgentiX Projects",
  robots: { index: false, follow: false }, // private app — keep out of search engines
  openGraph: {
    title: "AgentiX Projects",
    description: "Train your AI Project-Agents.",
    type: "website",
    locale: "de_DE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <StaleBuildRecovery />
          <AuthProvider>{children}</AuthProvider>
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
