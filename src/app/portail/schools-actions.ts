"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import { createSchoolForFounder, FounderSchoolError } from "@/server/founder-schools";

export type FounderSchoolActionState = { error?: string; success?: string };

export async function createFounderSchoolAction(
  _previousState: FounderSchoolActionState,
  formData: FormData,
): Promise<FounderSchoolActionState> {
  const input = {
    organizationId: formData.get("organizationId"),
    name: formData.get("name"),
    code: formData.get("code"),
    timeZone: formData.get("timeZone"),
  };
  const parsed = z.object({ organizationId: z.string(), name: z.string(), code: z.string(), timeZone: z.string() }).safeParse(input);
  if (!parsed.success) {
    return { error: "Vérifiez les informations de l’établissement." };
  }
  try {
    await createSchoolForFounder(await requireActiveUserId(), parsed.data);
  } catch (error) {
    if (error instanceof FounderSchoolError) return { error: error.message };
    throw error;
  }
  revalidatePath("/portail");
  return { success: "L’établissement a été créé." };
}
