"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AcademicStructureError,
  createAcademicYear,
  createClassGroup,
  updateAcademicYearStatus,
} from "@/server/academic-structure";
import { requireActiveUserId } from "@/server/session";

export type AcademicStructureActionState = {
  error?: string;
  success?: string;
};

const academicYearFormSchema = z.object({
  schoolId: z.string().min(1),
  label: z.string().trim().min(1).max(32),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
});

const classGroupFormSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  cycle: z.enum([
    "PRESCHOOL",
    "PRIMARY",
    "LOWER_SECONDARY",
    "UPPER_SECONDARY",
  ]),
});

const yearStatusFormSchema = z.object({
  schoolId: z.string().min(1),
  academicYearId: z.string().min(1),
  status: z.enum(["ACTIVE", "CLOSED"]),
});

function getServiceErrorMessage(error: AcademicStructureError) {
  switch (error.code) {
    case "FORBIDDEN":
    case "NOT_FOUND":
    case "ALREADY_EXISTS":
    case "INVALID_STATE":
    case "INVALID_INPUT":
      return error.message;
  }
}

export async function createAcademicYearAction(
  _previousState: AcademicStructureActionState,
  formData: FormData,
): Promise<AcademicStructureActionState> {
  const parsed = academicYearFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    label: formData.get("label"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });

  if (!parsed.success || parsed.data.startsOn >= parsed.data.endsOn) {
    return {
      error: "Vérifiez le libellé et l’ordre des dates de l’année scolaire.",
    };
  }

  try {
    await createAcademicYear(await requireActiveUserId(), parsed.data);
  } catch (error) {
    if (error instanceof AcademicStructureError) {
      return { error: getServiceErrorMessage(error) };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/scolarite`);
  return { success: "L’année scolaire a été créée au statut « à venir »." };
}

export async function createClassGroupAction(
  _previousState: AcademicStructureActionState,
  formData: FormData,
): Promise<AcademicStructureActionState> {
  const parsed = classGroupFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    academicYearId: formData.get("academicYearId"),
    label: formData.get("label"),
    cycle: formData.get("cycle"),
  });

  if (!parsed.success) {
    return { error: "Vérifiez le libellé, le cycle et l’année scolaire." };
  }

  try {
    await createClassGroup(await requireActiveUserId(), parsed.data);
  } catch (error) {
    if (error instanceof AcademicStructureError) {
      return { error: getServiceErrorMessage(error) };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/scolarite`);
  return { success: "La classe a été créée." };
}

export async function updateAcademicYearStatusAction(
  _previousState: AcademicStructureActionState,
  formData: FormData,
): Promise<AcademicStructureActionState> {
  const parsed = yearStatusFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    academicYearId: formData.get("academicYearId"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { error: "La demande de changement de statut est invalide." };
  }

  try {
    await updateAcademicYearStatus(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.academicYearId,
      parsed.data.status,
    );
  } catch (error) {
    if (error instanceof AcademicStructureError) {
      return { error: getServiceErrorMessage(error) };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/scolarite`);
  return {
    success:
      parsed.data.status === "ACTIVE"
        ? "L’année scolaire est maintenant active."
        : "L’année scolaire a été clôturée.",
  };
}
