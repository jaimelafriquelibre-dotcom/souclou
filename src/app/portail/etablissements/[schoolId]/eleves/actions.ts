"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import {
  archiveStudent,
  enrollStudent,
  restoreStudent,
  setStudentEnrollmentStatus,
  StudentRecordError,
  updateStudentRecord,
} from "@/server/student-records";

export type StudentActionState = {
  error?: string;
  success?: string;
};

const enrollmentFormSchema = z.object({
  schoolId: z.string().min(1),
  classGroupId: z.string().min(1),
  localReference: z.string().trim().max(32),
  familyName: z.string().trim().min(1).max(100),
  givenNames: z.string().trim().min(1).max(120),
});

const studentUpdateFormSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().min(1),
  localReference: z.string().trim().max(32),
  familyName: z.string().trim().min(1).max(100),
  givenNames: z.string().trim().min(1).max(120),
});

const studentActionSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().min(1),
});

const enrollmentActionSchema = z.object({
  schoolId: z.string().min(1),
  enrollmentId: z.string().min(1),
  status: z.enum(["ACTIVE", "WITHDRAWN"]),
});

function studentError(error: unknown): StudentActionState {
  if (error instanceof StudentRecordError) {
    return { error: error.message };
  }
  throw error;
}

function revalidateStudentPages(schoolId: string) {
  revalidatePath(`/portail/etablissements/${schoolId}/eleves`);
  revalidatePath(`/portail/etablissements/${schoolId}/pedagogie`);
  revalidatePath(`/portail/etablissements/${schoolId}/famille`);
  revalidatePath("/portail/notifications");
}

export async function enrollStudentAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = enrollmentFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    classGroupId: formData.get("classGroupId"),
    localReference: formData.get("localReference"),
    familyName: formData.get("familyName"),
    givenNames: formData.get("givenNames"),
  });

  if (!parsed.success) {
    return {
      error: "Vérifiez les noms, la référence interne et la classe.",
    };
  }

  try {
    await enrollStudent(await requireActiveUserId(), parsed.data);
  } catch (error) {
    return studentError(error);
  }

  revalidateStudentPages(parsed.data.schoolId);
  return { success: "L’élève a été inscrit dans la classe sélectionnée." };
}

export async function updateStudentRecordAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = studentUpdateFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    studentId: formData.get("studentId"),
    localReference: formData.get("localReference"),
    familyName: formData.get("familyName"),
    givenNames: formData.get("givenNames"),
  });
  if (!parsed.success) {
    return { error: "Vérifiez les noms et la référence interne." };
  }

  try {
    await updateStudentRecord(await requireActiveUserId(), parsed.data);
  } catch (error) {
    return studentError(error);
  }
  revalidateStudentPages(parsed.data.schoolId);
  return { success: "Les informations de l’élève ont été corrigées." };
}

export async function archiveStudentAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = studentActionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    studentId: formData.get("studentId"),
  });
  if (!parsed.success) {
    return { error: "La demande d’archivage est invalide." };
  }

  try {
    await archiveStudent(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.studentId,
    );
  } catch (error) {
    return studentError(error);
  }
  revalidateStudentPages(parsed.data.schoolId);
  return {
    success:
      "L’élève a été archivé. Ses inscriptions actives et accès familiaux ont été désactivés.",
  };
}

export async function restoreStudentAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = studentActionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    studentId: formData.get("studentId"),
  });
  if (!parsed.success) {
    return { error: "La demande de restauration est invalide." };
  }

  try {
    await restoreStudent(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.studentId,
    );
  } catch (error) {
    return studentError(error);
  }
  revalidateStudentPages(parsed.data.schoolId);
  return {
    success:
      "L’élève a été restauré. Les inscriptions et liens familiaux doivent être réactivés séparément.",
  };
}

export async function setStudentEnrollmentStatusAction(
  _previousState: StudentActionState,
  formData: FormData,
): Promise<StudentActionState> {
  const parsed = enrollmentActionSchema.safeParse({
    schoolId: formData.get("schoolId"),
    enrollmentId: formData.get("enrollmentId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: "La demande de modification d’inscription est invalide." };
  }

  try {
    await setStudentEnrollmentStatus(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.enrollmentId,
      parsed.data.status,
    );
  } catch (error) {
    return studentError(error);
  }
  revalidateStudentPages(parsed.data.schoolId);
  return {
    success:
      parsed.data.status === "ACTIVE"
        ? "L’inscription a été réactivée."
        : "L’inscription a été retirée de l’année en cours.",
  };
}
