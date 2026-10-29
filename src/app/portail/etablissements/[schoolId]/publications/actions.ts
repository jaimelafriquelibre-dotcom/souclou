"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import {
  decidePublication,
  PublicationError,
  savePublicationPolicy,
  submitPublication,
} from "@/server/publications";

export type PublicationActionState = {
  error?: string;
  success?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof PublicationError) {
    return error.message;
  }
  throw error;
}

export async function savePublicationPolicyAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      type: z.enum(["NOTICE", "EVENT", "OFFICIAL_INFORMATION"]),
      requiredApprovals: z.coerce.number().int().min(1).max(3),
      approverRoles: z.array(
        z.enum([
          "STUDIES_DIRECTOR",
          "EDUCATOR",
          "ADMINISTRATIVE_STAFF",
        ]),
      ),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      type: formData.get("type"),
      requiredApprovals: formData.get("requiredApprovals"),
      approverRoles: formData.getAll("approverRoles"),
    });

  if (!parsed.success) {
    return { error: "Vérifiez les rôles sélectionnés et le quorum." };
  }

  try {
    await savePublicationPolicy(await requireActiveUserId(), parsed.data);
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(
    `/portail/etablissements/${parsed.data.schoolId}/publications`,
  );
  return { success: "La règle de validation a été enregistrée." };
}

export async function submitPublicationAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      type: z.enum(["NOTICE", "EVENT", "OFFICIAL_INFORMATION"]),
      title: z.string().trim().min(1).max(160),
      body: z.string().trim().min(1).max(10000),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      type: formData.get("type"),
      title: formData.get("title"),
      body: formData.get("body"),
    });

  if (!parsed.success) {
    return {
      error: "Vérifiez le titre (160 caractères) et le contenu (10 000 caractères).",
    };
  }

  try {
    await submitPublication(await requireActiveUserId(), parsed.data);
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(
    `/portail/etablissements/${parsed.data.schoolId}/publications`,
  );
  return { success: "La publication a été soumise pour validation." };
}

export async function decidePublicationAction(
  _previousState: PublicationActionState,
  formData: FormData,
): Promise<PublicationActionState> {
  const parsed = z
    .object({
      schoolId: z.string().min(1),
      publicationId: z.string().min(1),
      decision: z.enum(["APPROVED", "REJECTED"]),
      comment: z.string().trim().max(500),
    })
    .safeParse({
      schoolId: formData.get("schoolId"),
      publicationId: formData.get("publicationId"),
      decision: formData.get("decision"),
      comment: formData.get("comment") ?? "",
    });

  if (!parsed.success) {
    return { error: "Vérifiez votre décision et le commentaire." };
  }

  try {
    await decidePublication(
      await requireActiveUserId(),
      parsed.data.schoolId,
      parsed.data.publicationId,
      parsed.data.decision,
      parsed.data.comment,
    );
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath(
    `/portail/etablissements/${parsed.data.schoolId}/publications`,
  );
  return {
    success:
      parsed.data.decision === "APPROVED"
        ? "Votre approbation a été enregistrée."
        : "La publication a été rejetée.",
  };
}
