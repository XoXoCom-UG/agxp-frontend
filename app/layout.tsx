import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./agxp-design.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { StaleBuildRecovery } from "@/components/layout/stale-build-recovery";

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
    <html lang="en" suppressHydrationWarning>
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
