import "server-only";

import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { canUserPerformInSchool } from "@/server/permissions";
import { normalizeSchoolSettings, schoolSettingsSchema } from "@/lib/school-settings-validation";

export class SchoolSettingsError extends Error {}

export async function updateSchoolSettings(
  actorUserId: string,
  input: z.input<typeof schoolSettingsSchema>,
) {
  let parsed: ReturnType<typeof normalizeSchoolSettings>;
  try {
    parsed = normalizeSchoolSettings(input);
  } catch {
    throw new SchoolSettingsError("Les paramètres fournis sont invalides.");
  }

  const { schoolId, name, code, timeZone } = parsed;
  if (!(await canUserPerformInSchool(actorUserId, schoolId, "update_official_school_settings"))) {
    throw new SchoolSettingsError("Vous n’êtes pas autorisé à modifier cet établissement.");
  }

  return prisma.$transaction(async (transaction) => {
    const school = await transaction.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, code: true, timeZone: true, organizationId: true },
    });
    if (!school) throw new SchoolSettingsError("Établissement introuvable.");

    const duplicate = await transaction.school.findFirst({
      where: { organizationId: school.organizationId, code, NOT: { id: schoolId } },
      select: { id: true },
    });
    if (duplicate) throw new SchoolSettingsError("Ce code existe déjà dans l’organisation.");

    const updated = await transaction.school.update({
      where: { id: schoolId },
      data: { name, code, timeZone },
      select: { id: true, name: true, code: true, timeZone: true },
    });
    await appendAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId,
      actorUserId,
      action: "SCHOOL_SETTINGS_UPDATED",
      entityType: "School",
      entityId: schoolId,
      before: { name: school.name, code: school.code, timeZone: school.timeZone },
      after: updated,
    });
    return updated;
  });
}
