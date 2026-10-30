import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { SignInForm } from "@/app/connexion/sign-in-form";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Connexion — SOUCLOU",
};

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="home-page flex min-h-screen items-center justify-center px-6 text-slate-600"
          role="status"
        >
          Chargement des établissements…
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

async function SignInContent() {
  await connection();
  const schools = await prisma.school.findMany({
    where: {
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      organization: { select: { name: true } },
    },
  });

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
        <SignInForm
          schools={schools.map((school) => ({
            id: school.id,
            name: school.name,
            organizationName: school.organization.name,
          }))}
        />
      </section>
    </main>
  );
}
