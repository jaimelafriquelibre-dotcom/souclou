import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section
        aria-labelledby="welcome-heading"
        className="landing-panel mx-auto w-full max-w-5xl"
      >
        <p className="landing-eyebrow mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">
          SOUCLOU · Établissements ivoiriens
        </p>
        <h1
          id="welcome-heading"
          className="landing-title max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
        >
          La vie scolaire, suivie avec clarté.
        </h1>
        <p className="landing-description mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Une plateforme de vie scolaire pensée pour les établissements de
          Côte d’Ivoire, avec des espaces séparés et des accès contrôlés.
        </p>
        <p className="landing-note mt-10 inline-flex rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-900">
          <span aria-hidden="true">✦</span>
          Démonstration · données fictives uniquement
        </p>
        <div>
          <Link
            className="landing-cta mt-8 inline-flex rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white transition-colors hover:bg-teal-900"
            href="/connexion"
          >
            Accéder à mon compte
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
