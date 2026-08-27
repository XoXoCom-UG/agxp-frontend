"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="flex items-center gap-px mb-8">
        <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">matfit</span>
        <span className="font-bold text-xl tracking-tight text-green-600">.ai</span>
      </div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-sm">
        Ein unerwarteter Fehler ist aufgetreten. Deine Daten sind sicher — versuch es einfach nochmal.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors duration-150 rounded-lg px-5 py-2.5"
        >
          Erneut versuchen
        </button>
        <a
          href="/chat"
          className="text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 rounded-lg px-5 py-2.5"
        >
          Zum Chat
        </a>
      </div>
    </div>
  );
}
