import "server-only";

import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { normalizeSchoolSettings } from "@/lib/school-settings-validation";

const createSchoolSchema = z.object({
  organizationId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(24).regex(/^[A-Za-z0-9_-]+$/),
  timeZone: z.string().trim().min(1).max(80),
});

export class FounderSchoolError extends Error {}

export async function setSchoolStatusForFounder(
  actorUserId: string,
  schoolId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  return prisma.$transaction(async (transaction) => {
    const school = await transaction.school.findUnique({
      where: { id: schoolId },
      select: { id: true, status: true, organizationId: true, organization: { select: { status: true } } },
    });
    if (!school || school.organization.status !== "ACTIVE") {
      throw new FounderSchoolError("Établissement ou organisation introuvable.");
    }
    const founder = await transaction.organizationMembership.findFirst({
      where: { userId: actorUserId, organizationId: school.organizationId, role: "FOUNDER", status: "ACTIVE" },
      select: { id: true },
    });
    if (!founder) throw new FounderSchoolError("Seul un fondateur actif peut modifier cet établissement.");
    if (school.status === status) throw new FounderSchoolError("Cet établissement possède déjà ce statut.");
    const updated = await transaction.school.update({ where: { id: schoolId }, data: { status }, select: { id: true, status: true } });
    await appendAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId,
      actorUserId,
      action: status === "SUSPENDED" ? "SCHOOL_SUSPENDED" : "SCHOOL_REACTIVATED",
      entityType: "School",
      entityId: schoolId,
      before: { status: school.status },
      after: { status: updated.status },
    });
    return updated;
  });
}

export async function createSchoolForFounder(
  actorUserId: string,
  input: z.input<typeof createSchoolSchema>,
) {
  let parsed: z.infer<typeof createSchoolSchema>;
  try {
    const validated = createSchoolSchema.parse(input);
    const normalized = normalizeSchoolSettings({ schoolId: "new", ...validated });
    parsed = { organizationId: validated.organizationId, ...normalized };
  } catch {
    throw new FounderSchoolError("Les paramètres du nouvel établissement sont invalides.");
  }

  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.organizationMembership.findFirst({
      where: {
        userId: actorUserId,
        organizationId: parsed.organizationId,
        role: "FOUNDER",
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      select: { organizationId: true },
    });
    if (!membership) throw new FounderSchoolError("Vous n’êtes pas fondateur de cette organisation.");

    const existing = await transaction.school.findUnique({
      where: { organizationId_code: { organizationId: parsed.organizationId, code: parsed.code } },
      select: { id: true },
    });
    if (existing) throw new FounderSchoolError("Ce code existe déjà dans l’organisation.");

    const school = await transaction.school.create({
      data: {
        organizationId: parsed.organizationId,
        name: parsed.name,
        code: parsed.code,
        timeZone: parsed.timeZone,
      },
      select: { id: true, name: true, code: true, timeZone: true },
    });
    await appendAuditEvent(transaction, {
      organizationId: parsed.organizationId,
      schoolId: school.id,
      actorUserId,
      action: "SCHOOL_CREATED",
      entityType: "School",
      entityId: school.id,
      after: school,
    });
    return school;
  });
}
