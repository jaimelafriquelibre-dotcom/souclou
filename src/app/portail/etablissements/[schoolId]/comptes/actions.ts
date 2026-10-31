"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  MembershipServiceError,
  approveSchoolMember,
  setSchoolMemberStatus,
} from "@/server/memberships";
import { requireActiveUserId } from "@/server/session";

export type MembershipActionState = {
  error?: string;
  success?: string;
};

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
    case "INVALID_STATE":
      return error.message;
  }
}

export async function setSchoolMemberStatusAction(
  _previousState: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const parsed = z.object({ schoolId: z.string().min(1), membershipId: z.string().min(1), status: z.enum(["ACTIVE", "SUSPENDED"]) }).safeParse({
    schoolId: formData.get("schoolId"), membershipId: formData.get("membershipId"), status: formData.get("status"),
  });
  if (!parsed.success) return { error: "La transition d’appartenance est invalide." };
  try {
    await setSchoolMemberStatus(await requireActiveUserId(), parsed.data.schoolId, parsed.data.membershipId, parsed.data.status);
  } catch (error) {
    if (error instanceof MembershipServiceError) return { error: getServiceErrorMessage(error) };
    throw error;
  }
  revalidatePath(`/portail/etablissements/${parsed.data.schoolId}/comptes`);
  return { success: "L’appartenance a été mise à jour." };
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
