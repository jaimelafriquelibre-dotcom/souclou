"use client";

import { useActionState } from "react";
import {
  requestMagicLink,
  type SignInState,
} from "@/app/connexion/actions";

const initialState: SignInState = {};

export function SignInForm() {
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState(
    requestMagicLink,
    initialState,
  );

  return (
    <section
        aria-labelledby="email-sign-in-heading"
        className="mx-auto mt-10 w-full max-w-4xl border-t border-slate-200/15 pt-8"
      >
        <h2
          className="text-xl font-semibold text-[#eaf2fb]"
          id="email-sign-in-heading"
        >
          Connexion par e-mail
        </h2>
        <form
          action={magicLinkAction}
          className="mx-auto mt-7 grid w-full gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
        >
          <div>
            <label
              className="mb-3 block text-sm font-medium text-[#b6c6d9] md:text-base"
              htmlFor="magic-link-email"
            >
              Adresse e-mail
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-slate-400/25 bg-slate-950/40 px-5 py-4 text-base text-white outline-none focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20"
              id="magic-link-email"
              name="email"
              required
              type="email"
            />
          </div>
          {magicLinkState.error ? (
            <p className="text-sm text-rose-300 md:col-span-2" role="alert">
              {magicLinkState.error}
            </p>
          ) : null}
          {magicLinkState.success ? (
            <p
              aria-live="polite"
              className="text-sm text-teal-200 md:col-span-2"
              role="status"
            >
              {magicLinkState.success}
            </p>
          ) : null}
          <button
            className="landing-cta flex min-h-14 w-full items-center justify-center rounded-lg px-6 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            disabled={magicLinkPending}
            type="submit"
          >
            {magicLinkPending
              ? "Envoi en cours…"
              : "Recevoir un lien temporaire"}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
  );
}
