import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { IconAlert } from "@/components/layout/agxp-icons";

/**
 * Shared frame for the public legal pages (Impressum / Datenschutz / AGB).
 * The copy is German legal text inside an English app, so the frame carries
 * lang="de" — screen readers and hyphenation then read it as German.
 */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal" lang="de">
      <header className="legal-head">
        <div className="legal-col">
          <Link href="/dashboard" className="legal-brand">
            <BrandLogo size={26} />
          </Link>
          <span className="sep" aria-hidden="true">/</span>
          <span className="where">{title}</span>
        </div>
      </header>

      <main className="legal-col legal-body">
        <h1>{title}</h1>
        {children}
      </main>

      <footer className="legal-foot">
        <div className="legal-col">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
          {/* Straight to the workspace: "/" only decides where to send you. */}
          <Link href="/dashboard" className="back">← Zur App</Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{heading}</h2>
      <div>{children}</div>
    </section>
  );
}

/**
 * Highlighted reminder that placeholders must be completed / legally reviewed.
 * These are notes to the team, not to visitors, so a production build leaves
 * them out entirely — the [placeholders] in the text stay visible either way.
 */
export function TodoNotice({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="legal-todo">
      <IconAlert size={15} />
      <p>{children}</p>
    </div>
  );
}
