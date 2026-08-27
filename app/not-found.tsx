import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6">
      <div className="flex items-center gap-px mb-8">
        <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50">matfit</span>
        <span className="font-bold text-xl tracking-tight text-green-600">.ai</span>
      </div>
      <p className="text-[80px] font-extrabold leading-none text-zinc-200 dark:text-zinc-800 mb-4 select-none">404</p>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Seite nicht gefunden</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-sm">
        Die Seite, die du suchst, existiert nicht oder wurde verschoben.
      </p>
      <Link
        href="/chat"
        className="text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors duration-150 rounded-lg px-5 py-2.5"
      >
        Zurück zum Chat
      </Link>
    </div>
  );
}
