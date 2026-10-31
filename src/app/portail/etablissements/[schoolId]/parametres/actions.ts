"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import { updateSchoolSettings } from "@/server/school-settings";
import { setSchoolStatusForFounder, FounderSchoolError } from "@/server/founder-schools";

export async function updateSchoolSettingsAction(formData: FormData) {
  const schoolId = z.string().min(1).parse(formData.get("schoolId"));
  await updateSchoolSettings(await requireActiveUserId(), {
    schoolId,
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    timeZone: String(formData.get("timeZone") ?? ""),
  });
  revalidatePath(`/portail/etablissements/${schoolId}/parametres`);
  revalidatePath("/portail");
}

export async function toggleSchoolStatusAction(formData: FormData) {
  const schoolId = z.string().min(1).parse(formData.get("schoolId"));
  const status = z.enum(["ACTIVE", "SUSPENDED"]).parse(formData.get("status"));
  try {
    await setSchoolStatusForFounder(await requireActiveUserId(), schoolId, status);
  } catch (error) {
    if (error instanceof FounderSchoolError) throw new Error(error.message);
    throw error;
  }
  revalidatePath(`/portail/etablissements/${schoolId}/parametres`);
  revalidatePath("/portail");
}
