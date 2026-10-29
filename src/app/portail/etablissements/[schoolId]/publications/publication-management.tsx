"use client";

import { useActionState } from "react";
import {
  decidePublicationAction,
  savePublicationPolicyAction,
  submitPublicationAction,
  type PublicationActionState,
} from "./actions";

type PublicationType = "NOTICE" | "EVENT" | "OFFICIAL_INFORMATION";
type ApproverRole =
  | "STUDIES_DIRECTOR"
  | "EDUCATOR"
  | "ADMINISTRATIVE_STAFF";

type Policy = {
  type: PublicationType;
  requiredApprovals: number;
  approverRoles: ApproverRole[];
};

type PublicationItem = {
  id: string;
  type: PublicationType;
  title: string;
  body: string;
  status: "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED";
  createdAt: Date;
  policy: { requiredApprovals: number };
  approvals: { decision: "APPROVED" | "REJECTED" }[];
  hasDecided: boolean;
};

type PublicationManagementProps = {
  schoolId: string;
  policies: Policy[];
  publications: PublicationItem[];
  canManagePolicies: boolean;
  canCreatePublication: boolean;
  canApprovePublicationIds: string[];
};

const types: { value: PublicationType; label: string }[] = [
  { value: "NOTICE", label: "Avis" },
  { value: "EVENT", label: "Événement" },
  { value: "OFFICIAL_INFORMATION", label: "Information officielle" },
];

const roles: { value: ApproverRole; label: string }[] = [
  { value: "STUDIES_DIRECTOR", label: "Direction des études" },
  { value: "EDUCATOR", label: "Éducateur" },
  { value: "ADMINISTRATIVE_STAFF", label: "Personnel administratif" },
];

const initialState: PublicationActionState = {};

function ActionMessage({ state }: { state: PublicationActionState }) {
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

export function PublicationManagement({
  schoolId,
  policies,
  publications,
  canManagePolicies,
  canCreatePublication,
  canApprovePublicationIds,
}: PublicationManagementProps) {
  const policyByType = new Map(policies.map((policy) => [policy.type, policy]));

  return (
    <div className="publication-workspace mt-8 space-y-8">
      {canManagePolicies ? (
        <section className="publication-panel publication-policy-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="publication-panel-heading">
            <span aria-hidden="true" className="publication-heading-icon policy-heading-icon">⌘</span>
            <div>
              <p className="publication-panel-kicker">GOUVERNANCE</p>
              <h2 className="text-xl font-semibold">Règles de validation</h2>
            </div>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Chaque catégorie a son propre quorum. Une personne ne peut donner
            qu’une seule décision par publication.
          </p>
          <div className="publication-policy-grid mt-6 grid gap-5 lg:grid-cols-3">
            {types.map((type) => (
              <PolicyForm
                key={type.value}
                policy={policyByType.get(type.value)}
                schoolId={schoolId}
                type={type}
              />
            ))}
          </div>
        </section>
      ) : null}

      {canCreatePublication ? (
        <PublicationForm policies={policies} schoolId={schoolId} />
      ) : null}

      <section className="publication-panel publication-list-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="publication-panel-heading">
          <span aria-hidden="true" className="publication-heading-icon list-heading-icon">▤</span>
          <div>
            <p className="publication-panel-kicker">FIL DE L’ÉTABLISSEMENT</p>
            <h2 className="text-xl font-semibold">Publications</h2>
          </div>
        </div>
        {publications.length === 0 ? (
          <p className="publication-empty mt-4 text-sm text-slate-600">
            Aucune publication disponible pour le moment.
          </p>
        ) : (
          <ul className="publication-list mt-4 divide-y divide-slate-200">
            {publications.map((publication) => {
              const approvalCount = publication.approvals.filter(
                (approval) => approval.decision === "APPROVED",
              ).length;
              return (
                <li className="publication-item py-5" key={publication.id}>
                  <div className="publication-item-heading flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{publication.title}</h3>
                    <span className={`publication-category-badge category-${publication.type.toLowerCase().replaceAll("_", "-")}`}>
                      {types.find((type) => type.value === publication.type)?.label}
                    </span>
                    <span className={`publication-status status-${publication.status.toLowerCase()}`}>
                      {publication.status === "PUBLISHED"
                        ? "Publiée"
                        : publication.status === "PENDING"
                          ? `En validation · ${approvalCount}/${publication.policy.requiredApprovals}`
                          : publication.status === "REJECTED"
                            ? "Rejetée"
                            : "Brouillon"}
                    </span>
                  </div>
                  <p className="publication-body mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {publication.body}
                  </p>
                  <p className="publication-date mt-2 text-xs text-slate-500">
                    {new Intl.DateTimeFormat("fr-CI", {
                      dateStyle: "long",
                      timeZone: "Africa/Abidjan",
                    }).format(publication.createdAt)}
                  </p>
                  {publication.status === "PENDING" &&
                  canApprovePublicationIds.includes(publication.id) &&
                  !publication.hasDecided ? (
                    <DecisionForm publication={publication} schoolId={schoolId} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function PolicyForm({
  schoolId,
  type,
  policy,
}: {
  schoolId: string;
  type: (typeof types)[number];
  policy?: Policy;
}) {
  const [state, formAction, pending] = useActionState(
    savePublicationPolicyAction,
    initialState,
  );

  return (
    <form action={formAction} className={`publication-policy-card policy-${type.value.toLowerCase().replaceAll("_", "-")} rounded-xl border border-slate-200 p-4`}>
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="type" type="hidden" value={type.value} />
      <div className="publication-policy-title">
        <span aria-hidden="true">{type.value === "NOTICE" ? "✦" : type.value === "EVENT" ? "◷" : "◆"}</span>
        <h3 className="font-semibold">{type.label}</h3>
      </div>
      <fieldset className="mt-3 space-y-2">
        <legend className="text-sm font-medium">Rôles approbateurs</legend>
        {roles.map((role) => (
          <label className="flex items-center gap-2 text-sm" key={role.value}>
            <input
              defaultChecked={
                policy?.approverRoles.includes(role.value) ??
                role.value === "STUDIES_DIRECTOR"
              }
              name="approverRoles"
              type="checkbox"
              value={role.value}
            />
            {role.label}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm font-medium" htmlFor={`quorum-${type.value}`}>
        Nombre d’approbations requises
      </label>
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        defaultValue={policy?.requiredApprovals ?? 1}
        id={`quorum-${type.value}`}
        name="requiredApprovals"
      >
        {[1, 2, 3].map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
      <div className="mt-3 space-y-2">
        <ActionMessage state={state} />
        <button
          className="publication-secondary-button rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enregistrement…" : "Enregistrer la règle"}
        </button>
      </div>
    </form>
  );
}

function PublicationForm({
  schoolId,
  policies,
}: {
  schoolId: string;
  policies: Policy[];
}) {
  const [state, formAction, pending] = useActionState(
    submitPublicationAction,
    initialState,
  );
  const configuredTypes = new Set(policies.map((policy) => policy.type));

  return (
    <section className="publication-panel publication-compose-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="publication-panel-heading">
        <span aria-hidden="true" className="publication-heading-icon compose-heading-icon">✎</span>
        <div>
          <p className="publication-panel-kicker">NOUVEAU MESSAGE</p>
          <h2 className="text-xl font-semibold">Soumettre une publication</h2>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        La publication sera visible des familles uniquement après avoir atteint
        le quorum défini pour sa catégorie.
      </p>
      <form action={formAction} className="publication-compose-form mt-5 grid gap-4">
        <input name="schoolId" type="hidden" value={schoolId} />
        <label className="text-sm font-medium">
          Catégorie
          <select
            className="publication-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            name="type"
            required
          >
            {types.map((type) => (
              <option
                disabled={!configuredTypes.has(type.value)}
                key={type.value}
                value={type.value}
              >
                {type.label}
                {!configuredTypes.has(type.value) ? " · règle non configurée" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Titre
          <input
            className="publication-input mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            maxLength={160}
            name="title"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Contenu
          <textarea
            className="publication-input mt-1 block min-h-32 w-full rounded-lg border border-slate-300 px-3 py-2"
            maxLength={10000}
            name="body"
            required
          />
        </label>
        <ActionMessage state={state} />
        <button
          className="publication-primary-button justify-self-start rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:opacity-60"
          disabled={pending || configuredTypes.size === 0}
          type="submit"
        >
          {pending ? "Soumission…" : "Soumettre aux approbateurs"}
        </button>
      </form>
    </section>
  );
}

function DecisionForm({
  schoolId,
  publication,
}: {
  schoolId: string;
  publication: PublicationItem;
}) {
  const [state, formAction, pending] = useActionState(
    decidePublicationAction,
    initialState,
  );

  return (
    <form action={formAction} className="publication-decision-form mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="publicationId" type="hidden" value={publication.id} />
      <label className="text-sm font-medium sm:col-span-3">
        Commentaire (facultatif)
        <input
          className="publication-input mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
          maxLength={500}
          name="comment"
        />
      </label>
      <button
        className="publication-primary-button rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        name="decision"
        type="submit"
        value="APPROVED"
      >
        Approuver
      </button>
      <button
        className="publication-reject-button rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60"
        disabled={pending}
        name="decision"
        type="submit"
        value="REJECTED"
      >
        Rejeter
      </button>
      <div className="sm:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
