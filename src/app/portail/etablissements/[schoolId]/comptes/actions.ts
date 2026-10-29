"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MembershipServiceError,
  approveSchoolMember,
  inviteSchoolMember,
} from "@/server/memberships";
import { requireActiveUserId } from "@/server/session";

export type MembershipActionState = {
  error?: string;
  success?: string;
};

const inviteFormSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum([
    "STUDIES_DIRECTOR",
    "EDUCATOR",
    "ADMINISTRATIVE_STAFF",
    "TEACHER",
    "STUDENT",
    "GUARDIAN",
  ]),
});

const approvalFormSchema = z.object({
  schoolId: z.string().min(1),
  membershipId: z.string().min(1),
});

function getServiceErrorMessage(error: MembershipServiceError) {
  switch (error.code) {
    case "FORBIDDEN":
      return "Vous n’êtes pas autorisé à effectuer cette action.";
    case "NOT_FOUND":
      return "La demande ou l’établissement n’existe plus.";
    case "ALREADY_EXISTS":
      return "Cette appartenance existe déjà.";
    case "INVALID_INPUT":
      return error.message;
    case "INVALID_STATE":
      return error.message;
  }
}

export async function inviteSchoolMemberAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const parsed = inviteFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return {
      error: "Vérifiez l’adresse e-mail, le nom et le rôle sélectionné.",
    };
  }

  try {
    await inviteSchoolMember(await requireActiveUserId(), parsed.data);
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return { error: getServiceErrorMessage(error) };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/comptes`);
  return { success: "Invitation créée. L’accès restera en attente d’approbation." };
}

export async function approveSchoolMemberAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const parsed = approvalFormSchema.safeParse({
    schoolId: formData.get("schoolId"),
    membershipId: formData.get("membershipId"),
  });

  if (!parsed.success) {
    return { error: "La demande d’accès est invalide." };
  }

  try {
    await approveSchoolMember(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.membershipId,
    );
  } catch (error) {
    if (error instanceof MembershipServiceError) {
      return { error: getServiceErrorMessage(error) };
    }

    throw error;
  }

  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/comptes`);
  return { success: "L’appartenance a été approuvée." };
}
