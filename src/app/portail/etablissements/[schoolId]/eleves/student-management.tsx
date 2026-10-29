"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { SchoolCycle } from "@/generated/prisma/client";
import {
  archiveStudentAction,
  enrollStudentAction,
  restoreStudentAction,
  setStudentEnrollmentStatusAction,
  type StudentActionState,
  updateStudentRecordAction,
} from "./actions";

type ClassOption = {
  id: string;
  label: string;
  cycle: SchoolCycle;
  academicYear: { label: string };
};

type StudentEntry = {
  id: string;
  status: "ACTIVE" | "ARCHIVED";
  localReference: string | null;
  familyName: string;
  givenNames: string;
  enrollments: {
    id: string;
    status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
    classGroup: { label: string; cycle: SchoolCycle };
    academicYear: { label: string };
  }[];
};

type StudentManagementProps = {
  schoolId: string;
  classes: ClassOption[];
  students: StudentEntry[];
  currentPage: number;
  hasNextPage: boolean;
  totalStudents: number;
  statusFilter: "active" | "archived";
};

const emptyState: StudentActionState = {};

const cycleLabels: Record<SchoolCycle, string> = {
  PRESCHOOL: "Préscolaire",
  PRIMARY: "Primaire",
  LOWER_SECONDARY: "Collège",
  UPPER_SECONDARY: "Lycée",
};

function ActionMessage({ state }: { state: StudentActionState }) {
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

export function StudentManagement({
  schoolId,
  classes,
  students,
  currentPage,
  hasNextPage,
  totalStudents,
  statusFilter,
}: StudentManagementProps) {
  const [state, formAction, pending] = useActionState(
    enrollStudentAction,
    emptyState,
  );
  const firstItem = totalStudents === 0 ? 0 : currentPage * 50 + 1;
  const lastItem = Math.min((currentPage + 1) * 50, totalStudents);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Nouvelle inscription</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Seules les informations nécessaires à l’inscription sont demandées.
          La référence est interne et facultative.
        </p>
        {classes.length === 0 ? (
          <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Aucune classe n’est disponible pour l’année scolaire en cours.
            Activez d’abord une année scolaire et créez ses classes.
          </p>
        ) : (
          <form action={formAction} className="mt-6 space-y-4">
            <input name="schoolId" type="hidden" value={schoolId} />
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="student-family-name"
              >
                Nom
              </label>
              <input
                autoComplete="family-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                id="student-family-name"
                maxLength={100}
                name="familyName"
                required
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="student-given-names"
              >
                Prénoms
              </label>
              <input
                autoComplete="given-name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                id="student-given-names"
                maxLength={120}
                name="givenNames"
                required
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="student-reference"
              >
                Référence interne (facultative)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                id="student-reference"
                maxLength={32}
                name="localReference"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                htmlFor="student-class"
              >
                Classe — année en cours
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                id="student-class"
                name="classGroupId"
                required
              >
                {classes.map((classOption) => (
                  <option key={classOption.id} value={classOption.id}>
                    {classOption.label} · {cycleLabels[classOption.cycle]} ·{" "}
                    {classOption.academicYear.label}
                  </option>
                ))}
              </select>
            </div>
            <ActionMessage state={state} />
            <button
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Inscription…" : "Inscrire l’élève"}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {statusFilter === "active" ? "Élèves actifs" : "Élèves archivés"}
          </h2>
          <a
            className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            href={`/api/portail/etablissements/${schoolId}/eleves/export`}
          >
            Télécharger le registre CSV
          </a>
        </div>
        <nav aria-label="Filtre du registre" className="mt-4 flex gap-4 text-sm">
          <Link
            aria-current={statusFilter === "active" ? "page" : undefined}
            className="font-semibold text-teal-800 underline underline-offset-4"
            href="?status=active"
          >
            Actifs
          </Link>
          <Link
            aria-current={statusFilter === "archived" ? "page" : undefined}
            className="font-semibold text-teal-800 underline underline-offset-4"
            href="?status=archived"
          >
            Archives
          </Link>
        </nav>
        {totalStudents === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            {statusFilter === "active"
              ? "Aucun élève actif n’est enregistré dans cet établissement."
              : "Aucun élève n’est archivé dans cet établissement."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              {totalStudents} élève{totalStudents > 1 ? "s" : ""} au total ·
              affichage {firstItem}–{lastItem}
            </p>
            <ul className="mt-4 divide-y divide-slate-200">
              {students.map((student) => {
                const currentEnrollment = student.enrollments[0];

                return (
                  <li className="py-4" key={student.id}>
                    <p className="font-medium">
                      {student.familyName}, {student.givenNames}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {currentEnrollment
                        ? `${currentEnrollment.classGroup.label} · ${cycleLabels[currentEnrollment.classGroup.cycle]} · ${currentEnrollment.academicYear.label}${currentEnrollment.status === "WITHDRAWN" ? " · inscription retirée" : ""}`
                        : "Aucune inscription dans l’année scolaire active"}
                      {student.localReference
                        ? ` · Réf. ${student.localReference}`
                        : ""}
                    </p>
                    <StudentRecordActions
                      currentEnrollment={currentEnrollment}
                      schoolId={schoolId}
                      student={student}
                    />
                  </li>
                );
              })}
            </ul>
            <nav
              aria-label="Pagination des élèves"
              className="mt-6 flex justify-between"
            >
              {currentPage > 0 ? (
                <a
                  className="font-semibold text-teal-800 underline underline-offset-4"
                  href={`?status=${statusFilter}&page=${currentPage - 1}`}
                >
                  Précédent
                </a>
              ) : (
                <span />
              )}
              {hasNextPage ? (
                <a
                  className="font-semibold text-teal-800 underline underline-offset-4"
                  href={`?status=${statusFilter}&page=${currentPage + 1}`}
                >
                  Suivant
                </a>
              ) : null}
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

function StudentRecordActions({
  schoolId,
  student,
  currentEnrollment,
}: {
  schoolId: string;
  student: StudentEntry;
  currentEnrollment: StudentEntry["enrollments"][number] | undefined;
}) {
  const [editState, editAction, editPending] = useActionState(
    updateStudentRecordAction,
    emptyState,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveStudentAction,
    emptyState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreStudentAction,
    emptyState,
  );
  const [enrollmentState, enrollmentAction, enrollmentPending] = useActionState(
    setStudentEnrollmentStatusAction,
    emptyState,
  );

  return (
    <div className="mt-3 space-y-3">
      {student.status === "ACTIVE" ? (
        <>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-teal-800">
              Corriger les informations
            </summary>
            <form action={editAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="schoolId" type="hidden" value={schoolId} />
              <input name="studentId" type="hidden" value={student.id} />
              <label className="text-sm font-medium">
                Nom
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  defaultValue={student.familyName}
                  maxLength={100}
                  name="familyName"
                  required
                />
              </label>
              <label className="text-sm font-medium">
                Prénoms
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  defaultValue={student.givenNames}
                  maxLength={120}
                  name="givenNames"
                  required
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Référence interne
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                  defaultValue={student.localReference ?? ""}
                  maxLength={32}
                  name="localReference"
                />
              </label>
              <div className="space-y-2 sm:col-span-2">
                <ActionMessage state={editState} />
                <button
                  className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 disabled:opacity-60"
                  disabled={editPending}
                  type="submit"
                >
                  {editPending ? "Correction…" : "Enregistrer les corrections"}
                </button>
              </div>
            </form>
          </details>
          {currentEnrollment ? (
            <form action={enrollmentAction} className="flex flex-wrap items-center gap-2">
              <input name="schoolId" type="hidden" value={schoolId} />
              <input
                name="enrollmentId"
                type="hidden"
                value={currentEnrollment.id}
              />
              <input
                name="status"
                type="hidden"
                value={
                  currentEnrollment.status === "ACTIVE" ? "WITHDRAWN" : "ACTIVE"
                }
              />
              <button
                className="text-sm font-semibold text-teal-800 underline underline-offset-4 disabled:opacity-60"
                disabled={enrollmentPending}
                type="submit"
              >
                {currentEnrollment.status === "ACTIVE"
                  ? "Retirer l’inscription de l’année"
                  : "Réactiver l’inscription"}
              </button>
              <ActionMessage state={enrollmentState} />
            </form>
          ) : null}
          <form
            action={archiveAction}
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Archiver cet élève ? Ses inscriptions actives seront retirées et ses liens familiaux désactivés.",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input name="schoolId" type="hidden" value={schoolId} />
            <input name="studentId" type="hidden" value={student.id} />
            <button
              className="text-sm font-semibold text-red-800 underline underline-offset-4 disabled:opacity-60"
              disabled={archivePending}
              type="submit"
            >
              {archivePending ? "Archivage…" : "Archiver l’élève"}
            </button>
            <ActionMessage state={archiveState} />
          </form>
        </>
      ) : (
        <form action={restoreAction} className="flex flex-wrap items-center gap-2">
          <input name="schoolId" type="hidden" value={schoolId} />
          <input name="studentId" type="hidden" value={student.id} />
          <button
            className="text-sm font-semibold text-teal-800 underline underline-offset-4 disabled:opacity-60"
            disabled={restorePending}
            type="submit"
          >
            {restorePending ? "Restauration…" : "Restaurer l’élève"}
          </button>
          <ActionMessage state={restoreState} />
        </form>
      )}
    </div>
  );
}
