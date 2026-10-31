"use client";

import { useActionState } from "react";
import {
  registerAccount,
  signInWithEmail,
  signInWithCredentials,
  type SignInState,
} from "@/app/connexion/actions";

const initialState: SignInState = {};

type RegistrationSchool = {
  id: string;
  name: string;
  organizationName: string;
};

const requestedRoles = [
  ["STUDIES_DIRECTOR", "Direction des études"],
  ["EDUCATOR", "Éducateur"],
  ["ADMINISTRATIVE_STAFF", "Personnel administratif"],
  ["TEACHER", "Enseignant"],
  ["STUDENT", "Élève / étudiant"],
  ["GUARDIAN", "Parent / tuteur"],
] as const;

export function SignInForm({
  schools,
  databaseAvailable,
  emailSignInEnabled,
}: {
  schools: RegistrationSchool[];
  databaseAvailable: boolean;
  emailSignInEnabled: boolean;
}) {
  const [signInState, signInAction, signInPending] = useActionState(
    signInWithCredentials,
    initialState,
  );
  const [emailState, emailAction, emailPending] = useActionState(signInWithEmail, initialState);
  const [registerState, registerAction, registerPending] = useActionState(
    registerAccount,
    initialState,
  );

  return (
    <section className="mx-auto mt-10 grid w-full max-w-5xl gap-8 border-t border-slate-200/15 pt-8 lg:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold text-[#eaf2fb]" id="sign-in-heading">
          Connexion
        </h2>
        <form action={signInAction} className="mt-7 grid gap-5">
          <div>
            <label
              className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base"
              htmlFor="sign-in-username"
            >
              Nom d’utilisateur
            </label>
            <input
              autoComplete="username"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="sign-in-username"
              name="username"
              required
              type="text"
            />
          </div>
          <div>
            <label
              className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base"
              htmlFor="sign-in-password"
            >
              Mot de passe
            </label>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="sign-in-password"
              name="password"
              required
              type="password"
            />
          </div>
          {signInState.error ? (
            <p className="text-sm text-rose-300" role="alert">
              {signInState.error}
            </p>
          ) : null}
          {signInState.success ? (
            <p aria-live="polite" className="text-sm text-teal-200" role="status">
              {signInState.success}
            </p>
          ) : null}
          <button
            className="landing-cta flex min-h-14 w-full items-center justify-center rounded-lg px-6 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={signInPending}
            type="submit"
          >
            {signInPending ? "Connexion…" : "Se connecter"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        {emailSignInEnabled ? <div className="mt-8 border-t border-slate-200/15 pt-6">
          <h3 className="text-lg font-semibold text-[#eaf2fb]">Connexion par e-mail</h3>
          <p className="mt-2 text-sm text-[#b6c6d9]">Utilisez le lien sécurisé envoyé à l’adresse d’un compte approuvé.</p>
          <form action={emailAction} className="mt-4 grid gap-4">
            <input autoComplete="email" className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white" name="email" placeholder="Adresse e-mail" required type="email" />
            {emailState.error ? <p className="text-sm text-rose-300" role="alert">{emailState.error}</p> : null}
            {emailState.success ? <p className="text-sm text-teal-200" role="status">{emailState.success}</p> : null}
            <button className="rounded-lg border border-teal-300/50 px-4 py-3 font-semibold text-teal-100 disabled:opacity-60" disabled={emailPending} type="submit">{emailPending ? "Envoi…" : "Recevoir un lien"}</button>
          </form>
        </div> : null}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-[#eaf2fb]" id="create-account-heading">
          Créer un compte
        </h2>
        <form action={registerAction} className="mt-7 grid gap-5">
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-name">
              Nom complet
            </label>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="register-name"
              name="name"
              required
              type="text"
            />
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-username">
              Nom d’utilisateur
            </label>
            <input
              autoComplete="username"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="register-username"
              name="username"
              required
              type="text"
            />
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-email">
              Adresse e-mail
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="register-email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-school">
              Établissement
            </label>
            <select
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              defaultValue=""
              id="register-school"
              name="schoolId"
              required
            >
              <option disabled value="">
                Choisir un établissement
              </option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.organizationName} · {school.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-role">
              Rôle demandé
            </label>
            <select
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              defaultValue=""
              id="register-role"
              name="role"
              required
            >
              <option disabled value="">
                Choisir un rôle
              </option>
              {requestedRoles.map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base" htmlFor="register-password">
              Mot de passe
            </label>
            <input
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="register-password"
              name="password"
              required
              type="password"
            />
          </div>
          {registerState.error ? (
            <p className="text-sm text-rose-300" role="alert">
              {registerState.error}
            </p>
          ) : null}
          {registerState.success ? (
            <p aria-live="polite" className="text-sm text-teal-200" role="status">
              {registerState.success}
            </p>
          ) : null}
          <button
            className="landing-cta flex min-h-14 w-full items-center justify-center rounded-lg px-6 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={registerPending || !databaseAvailable || schools.length === 0}
            type="submit"
          >
            {registerPending ? "Création…" : "Créer mon compte"}
            <span aria-hidden="true">→</span>
          </button>
          {!databaseAvailable ? (
            <p className="text-sm text-amber-700" role="status">
              Le service est temporairement indisponible. Réessayez dans quelques instants.
            </p>
          ) : schools.length === 0 ? (
            <p className="text-sm text-rose-300" role="status">
              Aucun établissement n’accepte actuellement les demandes de compte.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
