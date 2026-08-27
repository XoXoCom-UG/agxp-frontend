import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Shared frame for the public legal pages (Impressum / Datenschutz / AGB). */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
      <header className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-px leading-none">
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-50">matfit</span>
            <span className="font-bold text-sm tracking-tight text-green-600">.ai</span>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{title}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">{title}</h1>
        <div className="space-y-6 text-sm leading-relaxed">{children}</div>
      </main>

      <footer className="border-t border-zinc-100 dark:border-zinc-800 mt-10">
        <div className="max-w-3xl mx-auto px-5 py-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
          <Link href="/impressum" className="hover:text-zinc-700 dark:hover:text-zinc-200">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-zinc-700 dark:hover:text-zinc-200">Datenschutz</Link>
          <Link href="/agb" className="hover:text-zinc-700 dark:hover:text-zinc-200">AGB</Link>
          <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-200 ml-auto">← Zur App</Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1.5">{heading}</h2>
      <div className="space-y-2 text-zinc-600 dark:text-zinc-300">{children}</div>
    </section>
  );
}

/** Highlighted reminder that placeholders must be completed / legally reviewed. */
export function TodoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-amber-800 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}
