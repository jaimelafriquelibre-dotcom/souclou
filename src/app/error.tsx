"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section aria-labelledby="error-heading" className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">SOUCLOU</p>
        <h1 className="mt-4 text-2xl font-semibold" id="error-heading">Une erreur est survenue</h1>
        <p className="mt-3 text-slate-300">Votre opération n’a pas pu être terminée. Réessayez ou revenez au portail.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-500" onClick={reset} type="button">Réessayer</button>
          <a className="rounded-lg border border-slate-600 px-4 py-2 font-semibold text-slate-200 hover:bg-slate-800" href="/portail">Retour au portail</a>
        </div>
      </section>
    </main>
  );
}
