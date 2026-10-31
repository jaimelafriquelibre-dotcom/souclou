"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveUserId } from "@/server/session";
import { assignTechnicalAdmin, OrganizationGovernanceError, setTechnicalAdminStatus } from "@/server/organization-governance";

export async function assignTechnicalAdminAction(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().min(1), userEmail: z.string().email() }).safeParse({ organizationId: formData.get("organizationId"), userEmail: formData.get("userEmail") });
  if (!parsed.success) throw new Error("Données invalides.");
  try { await assignTechnicalAdmin(await requireActiveUserId(), parsed.data); }
  catch (error) { if (error instanceof OrganizationGovernanceError) throw new Error(error.message); throw error; }
  revalidatePath("/portail/organisation");
}

export async function setTechnicalAdminStatusAction(formData: FormData) {
  const parsed = z.object({ organizationId: z.string().min(1), membershipId: z.string().min(1), status: z.enum(["ACTIVE", "SUSPENDED"]) }).safeParse({ organizationId: formData.get("organizationId"), membershipId: formData.get("membershipId"), status: formData.get("status") });
  if (!parsed.success) throw new Error("Données invalides.");
  try { await setTechnicalAdminStatus(await requireActiveUserId(), parsed.data.organizationId, parsed.data.membershipId, parsed.data.status); }
  catch (error) { if (error instanceof OrganizationGovernanceError) throw new Error(error.message); throw error; }
  revalidatePath("/portail/organisation");
}
