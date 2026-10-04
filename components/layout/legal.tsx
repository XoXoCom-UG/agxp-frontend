import Link from "next/link";
import { BrandLogo } from "@/components/layout/brand-logo";
import { IconAlert } from "@/components/layout/agxp-icons";
import { COMPANY, missingCompanyFields } from "@/lib/company";

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
 * A note to the team about work still to do on the page — wording to review,
 * clauses a lawyer has to see. Not for visitors, so production leaves it out.
 *
 * This is NOT the right place for "the company details are missing": that one
 * must survive into production, which is what MissingDataNotice below is for.
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

const FIELD_LABELS: Record<string, string> = {
  name: "Firmenname", street: "Straße und Hausnummer", postalCode: "PLZ", city: "Ort",
  country: "Land", representedBy: "Vertretungsberechtigte Person", email: "E-Mail-Adresse",
  contentResponsible: "Verantwortlich nach § 18 Abs. 2 MStV", privacyEmail: "Datenschutz-Kontakt",
};

/**
 * Shown whenever lib/company.ts is still blank — in production too, and that
 * is the whole point.
 *
 * Before this existed, TodoNotice disappeared in a production build while the
 * "[Firmenname]" placeholders in the body stayed. A visitor then saw what
 * looked like a finished Impressum made of square brackets, and nobody on the
 * team saw a warning anywhere. Admitting the page is incomplete is the smaller
 * problem, and it is the one that gets fixed.
 */
export function MissingDataNotice() {
  const missing = missingCompanyFields();
  if (!missing.length) return null;
  const labels = missing.map(f => FIELD_LABELS[f] ?? f).join(", ");
  return (
    <div className="legal-todo legal-missing" role="status">
      <IconAlert size={15} />
      <p>
        Diese Seite ist noch nicht vollständig. Es fehlen: {labels}. Die Angaben werden
        zentral in <code>lib/company.ts</code> eingetragen; danach erscheinen sie auf
        allen drei Rechtsseiten.
      </p>
    </div>
  );
}

/**
 * One fact from lib/company.ts. While a field is blank it renders a visible
 * gap rather than a square-bracket placeholder, because a placeholder reads
 * like content someone meant to write and a gap reads like what it is.
 */
export function Fact({ field, prefix }: { field: keyof typeof COMPANY; prefix?: string }) {
  const value = COMPANY[field].trim();
  return (
    <p>
      {prefix ? `${prefix}: ` : ""}
      {value ? value : <span className="legal-gap">— noch nicht eingetragen —</span>}
    </p>
  );
}
