"use client";

import { useActionState } from "react";
import type {
  AcademicYearStatus,
  SchoolCycle,
} from "@/generated/prisma/client";
import {
  createAcademicYearAction,
  createClassGroupAction,
  type AcademicStructureActionState,
  updateAcademicYearStatusAction,
} from "./actions";
import { formatIvoirianDate } from "@/lib/locale";

type AcademicYear = {
  id: string;
  label: string;
  startsOn: Date;
  endsOn: Date;
  status: AcademicYearStatus;
};

type ClassGroup = {
  id: string;
  label: string;
  cycle: SchoolCycle;
  academicYear: { id: string; label: string };
};

type AcademicManagementProps = {
  schoolId: string;
  academicYears: AcademicYear[];
  classGroups: ClassGroup[];
};

const emptyState: AcademicStructureActionState = {};

const cycleLabels: Record<SchoolCycle, string> = {
  PRESCHOOL: "Préscolaire",
  PRIMARY: "Primaire",
  LOWER_SECONDARY: "Collège",
  UPPER_SECONDARY: "Lycée",
};

const yearStatusLabels: Record<AcademicYearStatus, string> = {
  PLANNED: "À venir",
  ACTIVE: "En cours",
  CLOSED: "Clôturée",
};

function ActionMessage({ state }: { state: AcademicStructureActionState }) {
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

export function AcademicManagement({
  schoolId,
  academicYears,
  classGroups,
}: AcademicManagementProps) {
  const [yearState, createYear, yearPending] = useActionState(
    createAcademicYearAction,
    emptyState,
  );
  const [classState, createClass, classPending] = useActionState(
    createClassGroupAction,
    emptyState,
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Années scolaires</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Saisissez les dates retenues par l’établissement ; aucune période
          scolaire n’est imposée.
        </p>
        <form action={createYear} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input name="schoolId" type="hidden" value={schoolId} />
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="academic-year-label"
            >
              Libellé
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              id="academic-year-label"
              maxLength={32}
              name="label"
              placeholder="Ex. 2026-2027"
              required
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="academic-year-start"
            >
              Date de début
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              id="academic-year-start"
              name="startsOn"
              required
              type="date"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="academic-year-end"
            >
              Date de fin
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              id="academic-year-end"
              name="endsOn"
              required
              type="date"
            />
          </div>
          <ActionMessage state={yearState} />
          <div className="sm:col-span-2">
            <button
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={yearPending}
              type="submit"
            >
              {yearPending ? "Création…" : "Créer l’année scolaire"}
            </button>
          </div>
        </form>

        <ul className="mt-6 divide-y divide-slate-200">
          {academicYears.map((year) => (
            <li className="py-4" key={year.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{year.label}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatIvoirianDate(year.startsOn)} –{" "}
                    {formatIvoirianDate(year.endsOn)}
                  </p>
                  <p className="mt-1 text-sm text-teal-900">
                    {yearStatusLabels[year.status]}
                  </p>
                </div>
                {year.status === "PLANNED" || year.status === "ACTIVE" ? (
                  <YearStatusButton
                    academicYearId={year.id}
                    schoolId={schoolId}
                    status={year.status === "PLANNED" ? "ACTIVE" : "CLOSED"}
                    text={year.status === "PLANNED" ? "Activer" : "Clôturer"}
                  />
                ) : null}
              </div>
            </li>
          ))}
          {academicYears.length === 0 ? (
            <li className="py-4 text-sm text-slate-600">
              Aucune année scolaire n’a encore été créée.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Classes</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Les cycles sont adaptés aux niveaux préscolaire, primaire, collège et
          lycée. Le libellé de classe reste libre pour suivre les usages de
          l’établissement.
        </p>
        {academicYears.some((year) => year.status !== "CLOSED") ? (
          <form action={createClass} className="mt-6 space-y-4">
            <input name="schoolId" type="hidden" value={schoolId} />
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="class-academic-year"
              >
                Année scolaire
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                id="class-academic-year"
                name="academicYearId"
                required
              >
                {academicYears
                  .filter((year) => year.status !== "CLOSED")
                  .map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="class-cycle"
              >
                Cycle
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                id="class-cycle"
                name="cycle"
                required
              >
                {Object.entries(cycleLabels).map(([cycle, label]) => (
                  <option key={cycle} value={cycle}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="class-label"
              >
                Libellé de la classe
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                id="class-label"
                maxLength={80}
                name="label"
                placeholder="Ex. CM2 A, 6e 1, Terminale D"
                required
              />
            </div>
            <ActionMessage state={classState} />
            <button
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={classPending}
              type="submit"
            >
              {classPending ? "Création…" : "Créer la classe"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-slate-600">
            Créez d’abord une année scolaire ouverte pour ajouter une classe.
          </p>
        )}

        <ul className="mt-6 divide-y divide-slate-200">
          {classGroups.map((classGroup) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 py-3"
              key={classGroup.id}
            >
              <span className="font-medium">{classGroup.label}</span>
              <span className="text-sm text-slate-600">
                {cycleLabels[classGroup.cycle]} · {classGroup.academicYear.label}
              </span>
            </li>
          ))}
          {classGroups.length === 0 ? (
            <li className="py-4 text-sm text-slate-600">
              Aucune classe n’a encore été créée.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function YearStatusButton({
  schoolId,
  academicYearId,
  status,
  text,
}: {
  schoolId: string;
  academicYearId: string;
  status: "ACTIVE" | "CLOSED";
  text: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateAcademicYearStatusAction,
    emptyState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="academicYearId" type="hidden" value={academicYearId} />
      <input name="status" type="hidden" value={status} />
      <button
        className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Mise à jour…" : text}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}
