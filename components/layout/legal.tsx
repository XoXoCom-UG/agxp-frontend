import Link from "next/link";

/** Shared frame for the public legal pages (Impressum / Datenschutz / AGB). */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-head">
        <div className="legal-col">
          <Link href="/" className="legal-brand">
            <span className="name">Agentix Projects</span>
            <span className="sub">AGXP</span>
          </Link>
          <span className="sep">/</span>
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
          <Link href="/" className="back">← Zur App</Link>
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

/** Highlighted reminder that placeholders must be completed / legally reviewed. */
export function TodoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="legal-todo">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" /><path d="M12 17h.01" />
      </svg>
      <p>{children}</p>
    </div>
  );
}
