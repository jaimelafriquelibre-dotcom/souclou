"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import {
  assignTeacherToClass,
  ClassroomWorkflowError,
  createGuardianStudentLink,
  createTimetableSlot,
  decideGuardianStudentLink,
  correctGrade,
  recordGrade,
} from "@/server/classroom-workflows";

export type ClassroomActionState = {
  error?: string;
  success?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof ClassroomWorkflowError) {
    return error.message;
  }
  throw error;
}

async function completeAction(
  operation: () => Promise<unknown>,
  schoolId: string,
  success: string,
): Promise<ClassroomActionState> {
  try {
    await operation();
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(`/portail/etablissements/${schoolId}/pedagogie`);
  return { success };
}

export async function createGuardianStudentLinkAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      studentId: z.string().min(1),
      guardianEmail: z.string().trim().email(),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      studentId: formData.get("studentId"),
      guardianEmail: formData.get("guardianEmail"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez l’élève et l’adresse du compte parent." };
  }

  return completeAction(
    async () =>
      createGuardianStudentLink(await requireActiveUserId(), parsed.data),
    parsed.data.schoolId,
    "La demande de rattachement parent-élève est en attente d’approbation.",
  );
}

export async function decideGuardianStudentLinkAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      linkId: z.string().min(1),
      decision: z.enum(["ACTIVE", "REJECTED"]),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      linkId: formData.get("linkId"),
      decision: formData.get("decision"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez la décision demandée." };
  }

  return completeAction(
    async () =>
      decideGuardianStudentLink(
        await requireActiveUserId(),
        parsed.data.schoolId,
        parsed.data.linkId,
        parsed.data.decision,
      ),
    parsed.data.schoolId,
    parsed.data.decision === "ACTIVE"
      ? "Le rattachement parent-élève a été approuvé."
      : "La demande de rattachement a été rejetée.",
  );
}

export async function assignTeacherToClassAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      classGroupId: z.string().min(1),
      teacherEmail: z.string().trim().email(),
      subject: z.string().trim().min(1).max(80),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      classGroupId: formData.get("classGroupId"),
      teacherEmail: formData.get("teacherEmail"),
      subject: formData.get("subject"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez la classe, le compte enseignant et la matière." };
  }

  return completeAction(
    async () => assignTeacherToClass(await requireActiveUserId(), parsed.data),
    parsed.data.schoolId,
    "L’enseignant a été affecté à cette matière et à cette classe.",
  );
}

export async function recordGradeAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      assignmentId: z.string().min(1),
      enrollmentId: z.string().min(1),
      assessmentLabel: z.string().trim().min(1).max(120),
      score: z.coerce.number().finite().min(0),
      maximumScore: z.coerce.number().finite().gt(0),
      assessedOn: z.iso.date(),
    })
    .refine(({ score, maximumScore }) => score <= maximumScore)
    .safeParse({
      schoolId: formData.get("schoolId"),
      assignmentId: formData.get("assignmentId"),
      enrollmentId: formData.get("enrollmentId"),
      assessmentLabel: formData.get("assessmentLabel"),
      score: formData.get("score"),
      maximumScore: formData.get("maximumScore"),
      assessedOn: formData.get("assessedOn"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez la note, son barème et la date d’évaluation." };
  }

  return completeAction(
    async () => recordGrade(await requireActiveUserId(), parsed.data),
    parsed.data.schoolId,
    "La note a été enregistrée.",
  );
}

export async function correctGradeAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      gradeId: z.string().min(1),
      assessmentLabel: z.string().trim().min(1).max(120),
      score: z.coerce.number().finite().min(0),
      maximumScore: z.coerce.number().finite().gt(0),
      assessedOn: z.iso.date(),
    })
    .refine(({ score, maximumScore }) => score <= maximumScore)
    .safeParse({
      schoolId: formData.get("schoolId"),
      gradeId: formData.get("gradeId"),
      assessmentLabel: formData.get("assessmentLabel"),
      score: formData.get("score"),
      maximumScore: formData.get("maximumScore"),
      assessedOn: formData.get("assessedOn"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez l’évaluation, la note, le barème et la date." };
  }

  return completeAction(
    async () => correctGrade(await requireActiveUserId(), parsed.data),
    parsed.data.schoolId,
    "La note a été corrigée et la modification journalisée.",
  );
}

export async function createTimetableSlotAction(
  _previousState: ClassroomActionState,
  formData: FormData,
): Promise<ClassroomActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      assignmentId: z.string().min(1),
      weekday: z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]),
      startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    })
    .refine(({ startsAt, endsAt }) => startsAt < endsAt)
    .safeParse({
      schoolId: formData.get("schoolId"),
      assignmentId: formData.get("assignmentId"),
      weekday: formData.get("weekday"),
      startsAt: formData.get("startsAt"),
      endsAt: formData.get("endsAt"),
    });
  if (!parsed.success) {
    return { error: "Vérifiez le jour et les horaires du cours." };
  }

  return completeAction(
    async () =>
      createTimetableSlot(await requireActiveUserId(), parsed.data),
    parsed.data.schoolId,
    "Le cours a été ajouté à l’emploi du temps.",
  );
}
