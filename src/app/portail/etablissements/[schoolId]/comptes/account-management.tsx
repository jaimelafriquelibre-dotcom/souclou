"use client";

import { useActionState } from "react";
import {
  approveSchoolMemberAction,
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
  approvableRoles: SchoolRole[];
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
  approvableRoles,
  pendingMemberships,
}: AccountManagementProps) {
  return (
    <div className="mt-8">
      <section>
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
                {approvableRoles.includes(membership.role) ? (
                  <ApproveMembershipButton
                    membershipId={membership.id}
                    schoolId={schoolId}
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    Approbation réservée au fondateur
                  </p>
                )}
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
