import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../auth";
import { signOutAction } from "@/app/portail/actions";

export default function PendingAccountPage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-600"
          role="status"
        >
          Chargement de votre compte…
        </main>
      }
    >
      <PendingAccountContent />
    </Suspense>
  );
}

async function PendingAccountContent() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.status === "SUSPENDED") {
    return (
      <main className="home-page flex min-h-screen items-center px-6 py-16">
        <section className="landing-panel mx-auto w-full max-w-4xl">
          <p className="landing-eyebrow mb-6 text-sm font-semibold uppercase tracking-[0.2em]">
            SOUCLOU · Accès au compte
          </p>
          <h1 className="landing-title mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Compte suspendu
          </h1>
          <p className="landing-description mx-auto mt-6 max-w-2xl text-lg leading-8">
            Contactez un responsable de votre établissement pour obtenir de
            l’aide.
          </p>
          <form action={signOutAction} className="mt-8">
            <button
              className="landing-cta inline-flex rounded-lg px-5 py-3 font-semibold text-white"
              type="submit"
            >
              Déconnexion
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="home-page flex min-h-screen items-center px-6 py-16">
      <section className="landing-panel mx-auto w-full max-w-4xl">
        <p className="landing-eyebrow mb-6 text-sm font-semibold uppercase tracking-[0.2em]">
          SOUCLOU · Accès au compte
        </p>
        <h1 className="landing-title mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Activation en attente
        </h1>
        <p className="landing-description mx-auto mt-6 max-w-2xl text-lg leading-8">
          Votre compte a été créé. Un responsable doit approuver votre demande
          d’accès avant toute consultation des données scolaires.
        </p>
        <form action={signOutAction} className="mt-8">
          <button
            className="landing-cta inline-flex rounded-lg px-5 py-3 font-semibold text-white"
            type="submit"
          >
            Déconnexion
          </button>
        </form>
      </section>
    </main>
  );
}
