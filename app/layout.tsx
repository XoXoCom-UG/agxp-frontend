import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { StaleBuildRecovery } from "@/components/layout/stale-build-recovery";

export const metadata: Metadata = {
  title: {
    default: "matfit.ai — IT Consulting Agent",
    template: "%s · matfit.ai",
  },
  description:
    "KI-gestützte IT-Beratung: Transformation Concepts, Roadmaps und fundiertes IT-Know-how in Minuten statt Wochen.",
  applicationName: "matfit.ai",
  robots: { index: false, follow: false }, // private app — keep out of search engines
  openGraph: {
    title: "matfit.ai — IT Consulting Agent",
    description: "Transformation Concepts in Minuten, nicht Wochen.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <StaleBuildRecovery />
          <AuthProvider>{children}</AuthProvider>
          <CookieBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
