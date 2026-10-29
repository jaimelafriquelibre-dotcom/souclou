import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="home-page flex min-h-screen items-center px-6 py-16">
      <section
        aria-labelledby="verify-heading"
        className="landing-panel mx-auto w-full max-w-4xl"
      >
        <p className="landing-eyebrow mb-6 text-sm font-semibold uppercase tracking-[0.2em]">
          SOUCLOU · Accès au compte
        </p>
        <h1
          id="verify-heading"
          className="landing-title mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl"
        >
          Vérifiez votre boîte e-mail
        </h1>
        <p className="landing-description mx-auto mt-6 max-w-2xl text-lg leading-8">
          Si votre compte est autorisé, un lien de connexion temporaire vient
          d’être envoyé. Il expire après quinze minutes.
        </p>
        <Link
          className="landing-cta mt-8 inline-flex rounded-lg px-5 py-3 font-semibold text-white"
          href="/connexion"
        >
          Retour à la connexion
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
