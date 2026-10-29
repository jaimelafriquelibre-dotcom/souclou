"use client";

import { useActionState } from "react";
import {
  approveSchoolMemberAction,
  inviteSchoolMemberAction,
  type MembershipActionState,
} from "./actions";
import type { SchoolRole } from "@/server/authorization";

type PendingMembership = {
  id: string;
  role: SchoolRole;
  user: {
    email: string;
    name: string | null;
  };
};

type AccountManagementProps = {
  schoolId: string;
  invitableRoles: SchoolRole[];
  pendingMemberships: PendingMembership[];
};

const initialState: MembershipActionState = {};

const roleLabels: Record<SchoolRole, string> = {
  STUDIES_DIRECTOR: "Direction des études",
  EDUCATOR: "Éducateur",
  ADMINISTRATIVE_STAFF: "Personnel administratif",
  TEACHER: "Enseignant",
  STUDENT: "Élève / étudiant",
  GUARDIAN: "Parent / tuteur",
} as const;

function ActionMessage({ state }: { state: MembershipActionState }) {
  if (state.error) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p aria-live="polite" className="text-sm text-teal-900" role="status">
        {state.success}
      </p>
    );
  }

  return null;
}

export function AccountManagement({
  schoolId,
  invitableRoles,
  pendingMemberships,
}: AccountManagementProps) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteSchoolMemberAction,
    initialState,
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Inviter un membre</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          L’invitation crée une appartenance en attente. Aucun accès scolaire
          n’est accordé avant approbation.
        </p>
        <form action={inviteAction} className="mt-6 space-y-4">
          <input name="schoolId" type="hidden" value={schoolId} />
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Nom complet
            </label>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              id="name"
              maxLength={120}
              name="name"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">
              Adresse e-mail
            </label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="role">
              Rôle demandé
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              defaultValue="TEACHER"
              id="role"
              name="role"
            >
              {invitableRoles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
          <ActionMessage state={inviteState} />
          <button
            className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={invitePending}
            type="submit"
          >
            {invitePending ? "Création…" : "Créer l’invitation"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Approbations en attente</h2>
        {pendingMemberships.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Aucune demande d’accès en attente.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {pendingMemberships.map((membership) => (
              <li
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={membership.id}
              >
                <div>
                  <p className="font-medium">
                    {membership.user.name ?? membership.user.email}
                  </p>
                  <p className="text-sm text-slate-600">
                    {membership.user.email} ·{" "}
                    {roleLabels[membership.role]}
                  </p>
                </div>
                <ApproveMembershipButton
                  membershipId={membership.id}
                  schoolId={schoolId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ApproveMembershipButton({
  schoolId,
  membershipId,
}: {
  schoolId: string;
  membershipId: string;
}) {
  const [state, formAction, pending] = useActionState(
    approveSchoolMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="membershipId" type="hidden" value={membershipId} />
      <button
        className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Approbation…" : "Approuver"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
