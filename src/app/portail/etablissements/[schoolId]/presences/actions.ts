"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AttendanceError, recordClassAttendance } from "@/server/attendance";
import { requireActiveUserId } from "@/server/session";

export type AttendanceActionState = {
  error?: string;
  success?: string;
};

const attendanceEntrySchema = z
  .string()
  .regex(/^[^:]+:(PRESENT|ABSENT|LATE|EXCUSED)$/)
  .transform((value) => {
    const separator = value.lastIndexOf(":");
    return {
      enrollmentId: value.slice(0, separator),
      status: value.slice(separator + 1),
    };
  })
  .pipe(
    z.object({
      enrollmentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
    }),
  );

const attendanceFormSchema = z
  .object({
    schoolId: z.string().min(1),
    classGroupId: z.string().min(1),
    date: z.iso.date(),
    entries: z.array(attendanceEntrySchema).min(1),
  })
  .refine(
    ({ entries }) =>
      new Set(entries.map((entry) => entry.enrollmentId)).size ===
      entries.length,
    "Un élève ne peut apparaître qu’une fois dans une feuille d’appel.",
  );

export async function recordClassAttendanceAction(
  _previousState: AttendanceActionState,
  formData: FormData,
): Promise<AttendanceActionState> {
  const parsed = attendanceFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    classGroupId: formData.get("classGroupId"),
    date: formData.get("date"),
    entries: formData.getAll("attendance"),
  });

  if (!parsed.success) {
    return {
      error:
        "Vérifiez la date et sélectionnez un statut pour chaque élève affiché.",
    };
  }

  try {
    const { schoolId, classGroupId, date, entries } = parsed.data;
    await recordClassAttendance(await requireActiveUserId(), {
      schoolId,
      classGroupId,
      date,
      entries,
    });
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/presences`);
  return { success: "La feuille de présence a été enregistrée." };
}
