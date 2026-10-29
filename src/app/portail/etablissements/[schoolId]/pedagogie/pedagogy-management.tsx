"use client";

import { useActionState } from "react";
import {
  assignTeacherToClassAction,
  createGuardianStudentLinkAction,
  createTimetableSlotAction,
  correctGradeAction,
  decideGuardianStudentLinkAction,
  recordGradeAction,
  type ClassroomActionState,
} from "./actions";

type ClassGroup = { id: string; label: string };
type StudentOption = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  classGroupId: string;
  classLabel: string;
};
type Assignment = {
  id: string;
  classGroupId: string;
  classLabel: string;
  subject: string;
  teacherName: string | null;
  teacherEmail: string;
};
type PendingLink = {
  id: string;
  guardianName: string | null;
  guardianEmail: string;
  studentName: string;
  classLabel: string;
};
type Grade = {
  id: string;
  subject: string;
  assessmentLabel: string;
  assessedOn: Date;
  score: string;
  maximumScore: string;
  studentName: string;
  classLabel: string;
};
type Timetable = {
  id: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  subject: string;
  classLabel: string;
  teacherName: string | null;
};

type PedagogyManagementProps = {
  schoolId: string;
  classes: ClassGroup[];
  students: StudentOption[];
  assignments: Assignment[];
  pendingLinks: PendingLink[];
  grades: Grade[];
  timetable: Timetable[];
  teachers: { name: string | null; email: string }[];
  canManageGuardianLinks: boolean;
  canApproveGuardianLinks: boolean;
  canManageAssignments: boolean;
  canRecordGrades: boolean;
  today: string;
};

const initialState: ClassroomActionState = {};

const weekdays = [
  ["MONDAY", "Lundi"],
  ["TUESDAY", "Mardi"],
  ["WEDNESDAY", "Mercredi"],
  ["THURSDAY", "Jeudi"],
  ["FRIDAY", "Vendredi"],
  ["SATURDAY", "Samedi"],
  ["SUNDAY", "Dimanche"],
] as const;

function ActionMessage({ state }: { state: ClassroomActionState }) {
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

export function PedagogyManagement(props: PedagogyManagementProps) {
  return (
    <div className="mt-8 space-y-8">
      {props.canManageGuardianLinks ? (
        <GuardianLinkSection {...props} />
      ) : null}
      {props.canManageAssignments ? <AssignmentSection {...props} /> : null}
      {props.canRecordGrades ? <GradeSection {...props} /> : null}
      {props.canManageAssignments ? <TimetableSection {...props} /> : null}
    </div>
  );
}

function GuardianLinkSection({
  schoolId,
  students,
  pendingLinks,
  canApproveGuardianLinks,
}: PedagogyManagementProps) {
  const [state, formAction, pending] = useActionState(
    createGuardianStudentLinkAction,
    initialState,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Rattacher un parent à un élève</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Le parent doit déjà disposer d’un compte actif dans cet établissement.
        Le lien reste en attente avant validation par la direction des études.
      </p>
      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input name="schoolId" type="hidden" value={schoolId} />
        <label className="text-sm font-medium">
          Élève inscrit
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            name="studentId"
            required
          >
            {students.map((student) => (
              <option key={student.enrollmentId} value={student.studentId}>
                {student.studentName} · {student.classLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          E-mail du compte parent
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            name="guardianEmail"
            required
            type="email"
          />
        </label>
        <div className="space-y-2 sm:col-span-2">
          <ActionMessage state={state} />
          <button
            className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
            disabled={pending || students.length === 0}
            type="submit"
          >
            {pending ? "Création…" : "Créer la demande"}
          </button>
        </div>
      </form>

      {canApproveGuardianLinks ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <h3 className="font-semibold">Demandes à approuver</h3>
          {pendingLinks.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              Aucune demande de rattachement en attente.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {pendingLinks.map((link) => (
                <li
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={link.id}
                >
                  <div>
                    <p className="font-medium">
                      {link.guardianName ?? link.guardianEmail}
                    </p>
                    <p className="text-sm text-slate-600">
                      {link.guardianEmail} · {link.studentName} · {link.classLabel}
                    </p>
                  </div>
                  <GuardianDecisionButtons linkId={link.id} schoolId={schoolId} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function GuardianDecisionButtons({
  schoolId,
  linkId,
}: {
  schoolId: string;
  linkId: string;
}) {
  const [state, formAction, pending] = useActionState(
    decideGuardianStudentLinkAction,
    initialState,
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="linkId" type="hidden" value={linkId} />
      <button
        className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        name="decision"
        type="submit"
        value="ACTIVE"
      >
        Approuver
      </button>
      <button
        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-60"
        disabled={pending}
        name="decision"
        type="submit"
        value="REJECTED"
      >
        Rejeter
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function AssignmentSection({
  schoolId,
  classes,
  teachers,
  assignments,
}: PedagogyManagementProps) {
  const [state, formAction, pending] = useActionState(
    assignTeacherToClassAction,
    initialState,
  );
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Affectations pédagogiques</h2>
      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-3">
        <input name="schoolId" type="hidden" value={schoolId} />
        <label className="text-sm font-medium">
          Classe
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            name="classGroupId"
            required
          >
            {classes.map((classGroup) => (
              <option key={classGroup.id} value={classGroup.id}>
                {classGroup.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Compte enseignant actif
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            name="teacherEmail"
            required
          >
            {teachers.map((teacher) => (
              <option key={teacher.email} value={teacher.email}>
                {teacher.name ?? teacher.email} · {teacher.email}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Matière
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            maxLength={80}
            name="subject"
            required
          />
        </label>
        <div className="space-y-2 sm:col-span-3">
          <ActionMessage state={state} />
          <button
            className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white disabled:opacity-60"
            disabled={pending || classes.length === 0 || teachers.length === 0}
            type="submit"
          >
            {pending ? "Affectation…" : "Affecter l’enseignant"}
          </button>
        </div>
      </form>
      <ul className="mt-5 divide-y divide-slate-200">
        {assignments.map((assignment) => (
          <li className="py-3 text-sm" key={assignment.id}>
            <span className="font-medium">{assignment.classLabel}</span> ·{" "}
            {assignment.subject} · {assignment.teacherName ?? assignment.teacherEmail}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GradeSection({
  schoolId,
  assignments,
  students,
  grades,
  today,
}: PedagogyManagementProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Carnet de notes</h2>
      {assignments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Aucune affectation active n’est disponible pour saisir des notes.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {assignments.map((assignment) => (
            <GradeForm
              assignment={assignment}
              key={assignment.id}
              schoolId={schoolId}
              students={students.filter(
                (student) => student.classGroupId === assignment.classGroupId,
              )}
              today={today}
            />
          ))}
        </div>
      )}
      {grades.length > 0 ? (
        <div className="mt-8 overflow-x-auto">
          <h3 className="font-semibold">Notes déjà saisies</h3>
          <table className="mt-3 w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-3 font-medium">Élève</th>
                <th className="py-2 pr-3 font-medium">Classe / matière</th>
                <th className="py-2 pr-3 font-medium">Évaluation</th>
                <th className="py-2 pr-3 font-medium">Note</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade) => (
                <tr
                  className="border-b border-slate-100"
                  key={grade.id}
                >
                  <td className="py-2 pr-3">{grade.studentName}</td>
                  <td className="py-2 pr-3">
                    {grade.classLabel} · {grade.subject}
                  </td>
                  <td className="py-2 pr-3">{grade.assessmentLabel}</td>
                  <td className="py-2 pr-3">
                    {grade.score}/{grade.maximumScore}
                  </td>
                  <td className="py-2">
                    <GradeCorrectionForm grade={grade} schoolId={schoolId} today={today} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function GradeCorrectionForm({
  grade,
  schoolId,
  today,
}: {
  grade: Grade;
  schoolId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    correctGradeAction,
    initialState,
  );
  const date = grade.assessedOn.toISOString().slice(0, 10);

  return (
    <details>
      <summary className="cursor-pointer font-semibold text-teal-900 underline underline-offset-4">
        Corriger
      </summary>
      <form action={formAction} className="mt-3 grid min-w-56 gap-2">
        <input name="schoolId" type="hidden" value={schoolId} />
        <input name="gradeId" type="hidden" value={grade.id} />
        <label className="text-xs font-medium">
          Évaluation
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            defaultValue={grade.assessmentLabel}
            maxLength={120}
            name="assessmentLabel"
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium">
            Note
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              defaultValue={grade.score}
              min="0"
              name="score"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="text-xs font-medium">
            Barème
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              defaultValue={grade.maximumScore}
              min="0.01"
              name="maximumScore"
              required
              step="0.01"
              type="number"
            />
          </label>
        </div>
        <label className="text-xs font-medium">
          Date
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            defaultValue={date}
            max={today}
            name="assessedOn"
            required
            type="date"
          />
        </label>
        <ActionMessage state={state} />
        <button
          className="justify-self-start rounded-lg border border-teal-800 px-3 py-1.5 text-sm font-semibold text-teal-900 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enregistrement…" : "Enregistrer la correction"}
        </button>
      </form>
    </details>
  );
}

function GradeForm({
  schoolId,
  assignment,
  students,
  today,
}: {
  schoolId: string;
  assignment: Assignment;
  students: StudentOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordGradeAction,
    initialState,
  );
  return (
    <form action={formAction} className="rounded-xl border border-slate-200 p-4">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="assignmentId" type="hidden" value={assignment.id} />
      <h3 className="font-semibold">
        {assignment.classLabel} · {assignment.subject}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Élève inscrit
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            name="enrollmentId"
            required
          >
            {students.map((student) => (
              <option key={student.enrollmentId} value={student.enrollmentId}>
                {student.studentName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Évaluation
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            maxLength={120}
            name="assessmentLabel"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Note obtenue
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            min="0"
            name="score"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="text-sm font-medium">
          Barème
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            defaultValue="20"
            min="0.01"
            name="maximumScore"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          Date
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            defaultValue={today}
            max={today}
            name="assessedOn"
            required
            type="date"
          />
        </label>
      </div>
      <div className="mt-3 space-y-2">
        <ActionMessage state={state} />
        <button
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending || students.length === 0}
          type="submit"
        >
          {pending ? "Enregistrement…" : "Enregistrer la note"}
        </button>
      </div>
    </form>
  );
}

function TimetableSection({
  schoolId,
  assignments,
  timetable,
}: PedagogyManagementProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Emploi du temps</h2>
      {assignments.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Créez d’abord une affectation pédagogique.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {assignments.map((assignment) => (
            <TimetableForm
              assignment={assignment}
              key={assignment.id}
              schoolId={schoolId}
            />
          ))}
        </div>
      )}
      {timetable.length > 0 ? (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {timetable.map((slot) => (
            <li
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
              key={slot.id}
            >
              <p className="font-semibold">
                {weekdays.find(([day]) => day === slot.weekday)?.[1]} ·{" "}
                {slot.startsAt}–{slot.endsAt}
              </p>
              <p className="mt-1 text-slate-600">
                {slot.classLabel} · {slot.subject}
              </p>
              {slot.teacherName ? (
                <p className="mt-1 text-slate-600">{slot.teacherName}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TimetableForm({
  schoolId,
  assignment,
}: {
  schoolId: string;
  assignment: Assignment;
}) {
  const [state, formAction, pending] = useActionState(
    createTimetableSlotAction,
    initialState,
  );
  return (
    <form action={formAction} className="rounded-xl border border-slate-200 p-4">
      <input name="schoolId" type="hidden" value={schoolId} />
      <input name="assignmentId" type="hidden" value={assignment.id} />
      <h3 className="font-semibold">
        {assignment.classLabel} · {assignment.subject}
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Jour
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2"
            name="weekday"
          >
            {weekdays.map(([day, label]) => (
              <option key={day} value={day}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Début
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2"
            defaultValue="08:00"
            name="startsAt"
            required
            type="time"
          />
        </label>
        <label className="text-sm font-medium">
          Fin
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2"
            defaultValue="09:00"
            name="endsAt"
            required
            type="time"
          />
        </label>
      </div>
      <div className="mt-3 space-y-2">
        <ActionMessage state={state} />
        <button
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Ajout…" : "Ajouter le cours"}
        </button>
      </div>
    </form>
  );
}
