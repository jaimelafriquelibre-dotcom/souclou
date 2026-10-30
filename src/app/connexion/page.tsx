import type { Metadata } from "next";
import { SignInForm } from "@/app/connexion/sign-in-form";

export const metadata: Metadata = {
  title: "Connexion — SOUCLOU",
};

export default function SignInPage() {
  return (
    <main className="home-page flex min-h-screen items-center px-6 py-12 sm:py-16">
      <section
        aria-labelledby="sign-in-heading"
        className="landing-panel mx-auto w-full max-w-5xl"
      >
        <p className="landing-eyebrow mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">
          SOUCLOU · Établissements ivoiriens
        </p>
        <h1
          id="sign-in-heading"
          className="landing-title max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
        >
          Connexion sécurisée
        </h1>
        <p className="landing-description mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Connectez-vous avec votre nom d’utilisateur et votre mot de passe.
          Les comptes sont créés par l’utilisateur puis approuvés par
          l’administration avant tout accès au portail.
        </p>
        <SignInForm />
      </section>
    </main>
  );
}
