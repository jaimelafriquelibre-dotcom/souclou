import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section aria-labelledby="not-found-heading" className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">SOUCLOU</p>
        <h1 className="mt-4 text-2xl font-semibold" id="not-found-heading">Page introuvable</h1>
        <p className="mt-3 text-slate-300">Cette page n’existe pas ou n’est plus accessible avec votre périmètre.</p>
        <Link className="mt-6 inline-flex rounded-lg bg-teal-600 px-4 py-2 font-semibold text-white hover:bg-teal-500" href="/portail">Retour au portail</Link>
      </section>
    </main>
  );
}
