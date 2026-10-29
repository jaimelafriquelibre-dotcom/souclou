"use client";

import { useActionState } from "react";
import type { AttendanceStatus, SchoolCycle } from "@/generated/prisma/client";
import {
  recordClassAttendanceAction,
  type AttendanceActionState,
} from "./actions";
import { formatIvoirianDate } from "@/lib/locale";

type AttendanceEntry = {
  id: string;
  student: { familyName: string; givenNames: string };
  attendanceRecords: { status: AttendanceStatus }[];
};

type AttendanceClass = {
  id: string;
  label: string;
  cycle: SchoolCycle;
  academicYear: { label: string };
};

type AttendanceManagementProps = {
  schoolId: string;
  attendanceDate: string;
  selectedClassId: string;
  classes: AttendanceClass[];
  entries: AttendanceEntry[];
};

const emptyState: AttendanceActionState = {};

const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Absence justifiée",
};

const cycleLabels: Record<SchoolCycle, string> = {
  PRESCHOOL: "Préscolaire",
  PRIMARY: "Primaire",
  LOWER_SECONDARY: "Collège",
  UPPER_SECONDARY: "Lycée",
};

function ActionMessage({ state }: { state: AttendanceActionState }) {
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

export function AttendanceManagement({
  schoolId,
  attendanceDate,
  selectedClassId,
  classes,
  entries,
}: AttendanceManagementProps) {
  const [state, formAction, pending] = useActionState(
    recordClassAttendanceAction,
    emptyState,
  );

  return (
    <div className="mt-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Feuille d’appel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Chaque statut doit être choisi explicitement. Les absences et retards
          sont enregistrés pour la date sélectionnée dans le fuseau d’Abidjan.
        </p>
        <form
          action={`/portail/etablissements/${schoolId}/presences`}
          className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="attendance-class-filter"
            >
              Classe
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              defaultValue={selectedClassId}
              id="attendance-class-filter"
              name="classId"
              required
            >
              {classes.map((classGroup) => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.label} · {cycleLabels[classGroup.cycle]} ·{" "}
                  {classGroup.academicYear.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="attendance-date-filter"
            >
              Date
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              defaultValue={attendanceDate}
              id="attendance-date-filter"
              name="date"
              required
              type="date"
            />
          </div>
          <button
            className="self-end rounded-lg border border-teal-800 px-4 py-2 font-semibold text-teal-900 hover:bg-teal-50"
            type="submit"
          >
            Afficher
          </button>
        </form>

        {selectedClassId ? (
          <a
            className="mt-5 inline-flex rounded-lg border border-teal-800 px-3 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            href={`/api/portail/etablissements/${schoolId}/presences/export?classId=${encodeURIComponent(selectedClassId)}&date=${encodeURIComponent(attendanceDate)}`}
          >
            Télécharger la feuille d’appel CSV
          </a>
        ) : null}

        {classes.length === 0 ? (
          <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            Aucune classe n’est disponible dans une année scolaire active.
          </p>
        ) : entries.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600">
            Aucun élève actif n’est inscrit dans cette classe.
          </p>
        ) : (
          <form action={formAction} className="mt-6">
            <input name="schoolId" type="hidden" value={schoolId} />
            <input
              name="classGroupId"
              type="hidden"
              value={selectedClassId}
            />
            <input name="date" type="hidden" value={attendanceDate} />
            <p className="mb-4 text-sm font-medium text-slate-700">
              {formatIvoirianDate(new Date(`${attendanceDate}T00:00:00.000Z`))}
            </p>
            <ul className="divide-y divide-slate-200">
              {entries.map((entry) => (
                <li
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={entry.id}
                >
                  <p className="font-medium">
                    {entry.student.familyName}, {entry.student.givenNames}
                  </p>
                  <select
                    aria-label={`Présence de ${entry.student.givenNames} ${entry.student.familyName}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    defaultValue={
                      entry.attendanceRecords[0]
                        ? `${entry.id}:${entry.attendanceRecords[0].status}`
                        : ""
                    }
                    name="attendance"
                    required
                  >
                    <option value="">Choisir un statut</option>
                    {Object.entries(attendanceLabels).map(([status, label]) => (
                      <option key={status} value={`${entry.id}:${status}`}>
                        {label}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-3">
              <ActionMessage state={state} />
              <button
                className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending}
                type="submit"
              >
                {pending ? "Enregistrement…" : "Enregistrer la présence"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
