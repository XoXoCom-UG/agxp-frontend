"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentHero } from "@/components/layout/agent-hero";
import { BrandLogo } from "@/components/layout/brand-logo";
import { IconArrow, IconChart, IconDoc, IconPencil } from "@/components/layout/agxp-icons";
import { useAuth } from "@/lib/auth-context";
import { COMPANY } from "@/lib/company";
import { ConsentLink } from "@/components/layout/cookie-banner";
import { useT } from "@/lib/language";

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
  const t = useT();
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/dashboard");
  }, [session, loading, router]);

  return (
    <div className="lp">
      <header className="lp-bar">
        <BrandLogo size={26} />
        <Link className="lp-signin" href="/login">{t("Sign in")} <IconArrow size={14} /></Link>
      </header>

      <main className="lp-main" id="main-content">
        <AgentHero
          kicker="AgentiX Projects"
          title={<h1 className="home-title">{t("Your consultant.")}<br /><span>{t("Your plan.")}</span></h1>}
          lede={t("Describe your project in one sentence. The right consultant picks the methods, drafts them and writes the document with you.")}
        >
          <Link className="home-start" href="/login">{t("Enter with your beta key")} <IconArrow size={16} /></Link>
        </AgentHero>

        {/* What happens, in the order it happens (2026-11-27): the same three
            steps the start screen shows, so the page promises what the product
            does — one consultant chosen for you, methods drafted, a document to
            hand on. The Assistant is a help beside it, not a second thing to learn. */}
        <section className="lp-pair lp-three" aria-label={t("How it works")}>
          <article>
            <div className="lp-card-top">
              <span className="lp-ic consultant" aria-hidden="true"><IconPencil size={15} /></span>
              <span className="lp-eyebrow">1</span>
            </div>
            <h2>{t("Describe it")}</h2>
            <p>{t("A sentence is enough: a new CRM, an AI idea, a reorganisation.")}</p>
          </article>
          <article>
            <div className="lp-card-top">
              <span className="lp-ic consultant" aria-hidden="true"><IconChart size={15} /></span>
              <span className="lp-eyebrow">2</span>
            </div>
            <h2>{t("Methods, drafted")}</h2>
            <p>{t("The fitting consultant drafts every method at once. Improve the ones that matter.")}</p>
          </article>
          <article>
            <div className="lp-card-top">
              <span className="lp-ic coach" aria-hidden="true"><IconDoc size={15} /></span>
              <span className="lp-eyebrow">3</span>
            </div>
            <h2>{t("A document to hand on")}</h2>
            <p>{t("As Word, as PDF or as a read-only link for your team.")}</p>
          </article>
        </section>

        {/* Required, and placed where it is read rather than buried in the
            terms: the agents write documents people take into real meetings. */}
        <p className="lp-ai" role="note">
          {t("AgentiX Projects is powered by AI and can get things wrong. Check anything you rely on.")}
        </p>

        <p className="lp-beta">{t("Closed beta. You need an invitation to sign in.")}</p>
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
          <ConsentLink />
        </nav>
      </footer>
    </div>
  );
}
