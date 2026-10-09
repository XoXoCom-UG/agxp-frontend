"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentHero } from "@/components/layout/agent-hero";
import { BrandLogo } from "@/components/layout/brand-logo";
import { IconArrow, IconChart, IconUsers, IconAlert } from "@/components/layout/agxp-icons";
import { useAuth } from "@/lib/auth-context";
import { COMPANY } from "@/lib/company";

/**
 * The public page at "/".
 *
 * Asked for in the 2026-10-09 call: agentics-projects.com is linked from the
 * company site and there was nothing behind it — proxy.ts sent every visitor
 * straight to /login, so the link led to a sign-in box with no explanation.
 * Patryk's brief was "Hauptsache da ist was", a mask; this is that, built
 * from pieces that already exist rather than invented.
 *
 * It shares its hero with the Home screen (AgentHero), so the promise made
 * here and the first screen after signing in are literally the same picture.
 *
 * A signed-in visitor is sent on to the workspace. The redirect waits for a
 * real session rather than the cookie, for the reason written at length in
 * proxy.ts: the cookie can outlive its session, and trusting it here is how
 * the old redirect loop started. Until that resolves this page simply shows
 * — it is a real page, so there is nothing to flash.
 */
export function Landing() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading, router]);

  return (
    <div className="lp">
      <header className="lp-bar">
        <BrandLogo size={26} />
        <Link className="lp-signin" href="/login">Sign in <IconArrow size={14} /></Link>
      </header>

      <main className="lp-main" id="main-content">
        <AgentHero
          kicker="AgentiX Projects"
          title={<h1 className="home-title">Two agents.<br /><span>One project.</span></h1>}
          lede="One plans the work. The other plans the people."
        >
          <Link className="home-start" href="/login">Enter with your beta key <IconArrow size={16} /></Link>
        </AgentHero>

        {/* What the two of them actually hand you. The same two deliverables
            lib/deliverables.ts defines, named the same way, because a landing
            page that promises something the product does not produce is the
            easiest way to lose the first customer. */}
        <section className="lp-pair" aria-label="What you get">
          <article>
            <span className="lp-ic consultant" aria-hidden="true"><IconChart size={17} /></span>
            <h2>Transformation Concept</h2>
            <p>
              Your Consultant interviews you about where you are, what it costs you today
              and where you are going — and writes it up as charts, not paragraphs.
            </p>
          </article>
          <article>
            <span className="lp-ic coach" aria-hidden="true"><IconUsers size={17} /></span>
            <h2>Change Plan</h2>
            <p>
              Your Coach works the other half: who is affected, what they are afraid of,
              and how the rollout actually lands with the people who have to live with it.
            </p>
          </article>
        </section>

        {/* Required, and placed where it is read rather than buried in the
            terms: the agents write documents people take into real meetings. */}
        <p className="lp-ai" role="note">
          <IconAlert size={14} aria-hidden="true" />
          <span>
            AgentiX Projects is powered by AI. It can get things wrong — check anything
            you rely on before acting on it.
          </span>
        </p>

        <p className="lp-beta">Closed beta. You need an invitation to sign in.</p>
      </main>

      <footer className="lp-foot">
        {/* From lib/company.ts, the one place the company's details live —
            not typed in here. While it is unfilled the line is just the
            year, which is honest; the Impressum is where the law wants the
            name, and that page already says loudly when it is missing. */}
        <span>© {new Date().getFullYear()}{COMPANY.name ? ` ${COMPANY.name}` : ""}</span>
        <nav aria-label="Legal">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </nav>
      </footer>
    </div>
  );
}
