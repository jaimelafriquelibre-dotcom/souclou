"use client";

import { useActionState } from "react";
import { createFounderSchoolAction, type FounderSchoolActionState } from "./schools-actions";

const emptyState: FounderSchoolActionState = {};

export function SchoolCreationForm({ organizations }: { organizations: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createFounderSchoolAction, emptyState);
  if (organizations.length === 0) return null;
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Ajouter un établissement</h2>
      <p className="mt-2 text-sm text-slate-600">Créez un nouvel établissement dans une organisation que vous dirigez.</p>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label>Organisation<select name="organizationId" required>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
        <label>Nom<input name="name" minLength={2} maxLength={120} required /></label>
        <label>Code<input name="code" pattern="[A-Za-z0-9_-]+" required /></label>
        <label>Fuseau horaire<input defaultValue="Africa/Abidjan" name="timeZone" required /></label>
        {state.error ? <p className="text-sm text-red-700" role="alert">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-teal-900" role="status">{state.success}</p> : null}
        <button className="portal-primary-button sm:col-span-2" disabled={pending} type="submit">{pending ? "Création…" : "Créer l’établissement"}</button>
      </form>
    </section>
  );
}
