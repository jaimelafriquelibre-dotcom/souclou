import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { canUserPerformInSchoolUsing } from "@/server/permissions";

export type AcademicStructureErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class AcademicStructureError extends Error {
  constructor(
    readonly code: AcademicStructureErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AcademicStructureError";
  }
}

const dateSchema = z.iso.date();

const academicYearSchema = z
  .object({
    schoolId: z.string().min(1),
    label: z.string().trim().min(1).max(32),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine(
    ({ startsOn, endsOn }) => startsOn < endsOn,
    "La date de fin doit être postérieure à la date de début.",
  );

const classGroupSchema = z.object({
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

async function requireSchoolStructurePermission(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  schoolId: string,
) {
  const school = await transaction.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      organization: { select: { status: true } },
    },
  });

  if (
    !school ||
    school.status !== "ACTIVE" ||
    school.organization.status !== "ACTIVE"
  ) {
    throw new AcademicStructureError(
      "NOT_FOUND",
      "Établissement actif introuvable.",
    );
  }

  if (
    !(await canUserPerformInSchoolUsing(
      transaction,
      actorUserId,
      school.id,
      "manage_academic_structure",
    ))
  ) {
    throw new AcademicStructureError(
      "FORBIDDEN",
      "Seule la direction autorisée peut gérer la structure scolaire.",
    );
  }

  return school;
}

export async function createAcademicYear(
  actorUserId: string,
  input: z.input<typeof academicYearSchema>,
) {
  const parsed = academicYearSchema.safeParse(input);

  if (!parsed.success) {
    throw new AcademicStructureError(
      "INVALID_INPUT",
      "Vérifiez le libellé et les dates de l’année scolaire.",
    );
  }

  const { schoolId, label, startsOn, endsOn } = parsed.data;

  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolStructurePermission(
        transaction,
        actorUserId,
        schoolId,
      );

      const existing = await transaction.academicYear.findUnique({
        where: { schoolId_label: { schoolId, label } },
        select: { id: true },
      });

      if (existing) {
        throw new AcademicStructureError(
          "ALREADY_EXISTS",
          "Cette année scolaire existe déjà dans l’établissement.",
        );
      }

      const academicYear = await transaction.academicYear.create({
        data: {
          schoolId,
          label,
          startsOn: new Date(`${startsOn}T00:00:00.000Z`),
          endsOn: new Date(`${endsOn}T00:00:00.000Z`),
        },
        select: {
          id: true,
          label: true,
          startsOn: true,
          endsOn: true,
          status: true,
        },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "ACADEMIC_YEAR_CREATED",
        entityType: "AcademicYear",
        entityId: academicYear.id,
        after: {
          label: academicYear.label,
          status: academicYear.status,
        },
      });

      return academicYear;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createClassGroup(
  actorUserId: string,
  input: z.input<typeof classGroupSchema>,
) {
  const parsed = classGroupSchema.safeParse(input);

  if (!parsed.success) {
    throw new AcademicStructureError(
      "INVALID_INPUT",
      "Vérifiez le libellé, le cycle et l’année scolaire.",
    );
  }

  const { schoolId, academicYearId, label, cycle } = parsed.data;

  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolStructurePermission(
        transaction,
        actorUserId,
        schoolId,
      );
      const academicYear = await transaction.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true, status: true },
      });

      if (!academicYear) {
        throw new AcademicStructureError(
          "NOT_FOUND",
          "Année scolaire introuvable dans cet établissement.",
        );
      }

      if (academicYear.status === "CLOSED") {
        throw new AcademicStructureError(
          "INVALID_STATE",
          "Une classe ne peut pas être ajoutée à une année clôturée.",
        );
      }

      const existing = await transaction.classGroup.findUnique({
        where: { academicYearId_label: { academicYearId, label } },
        select: { id: true },
      });

      if (existing) {
        throw new AcademicStructureError(
          "ALREADY_EXISTS",
          "Cette classe existe déjà pour l’année sélectionnée.",
        );
      }

      const classGroup = await transaction.classGroup.create({
        data: { schoolId, academicYearId, label, cycle },
        select: { id: true, label: true, cycle: true, academicYearId: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "CLASS_GROUP_CREATED",
        entityType: "ClassGroup",
        entityId: classGroup.id,
        after: {
          label: classGroup.label,
          cycle: classGroup.cycle,
          academicYearId: classGroup.academicYearId,
        },
      });

      return classGroup;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateAcademicYearStatus(
  actorUserId: string,
  schoolId: string,
  academicYearId: string,
  nextStatus: "ACTIVE" | "CLOSED",
) {
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolStructurePermission(
        transaction,
        actorUserId,
        schoolId,
      );
      const academicYear = await transaction.academicYear.findFirst({
        where: { id: academicYearId, schoolId },
        select: { id: true, label: true, status: true },
      });

      if (!academicYear) {
        throw new AcademicStructureError(
          "NOT_FOUND",
          "Année scolaire introuvable dans cet établissement.",
        );
      }

      const allowedTransition =
        (academicYear.status === "PLANNED" && nextStatus === "ACTIVE") ||
        (academicYear.status === "ACTIVE" && nextStatus === "CLOSED");

      if (!allowedTransition) {
        throw new AcademicStructureError(
          "INVALID_STATE",
          "Cette transition d’année scolaire n’est pas autorisée.",
        );
      }

      if (nextStatus === "ACTIVE") {
        const activeYear = await transaction.academicYear.findFirst({
          where: { schoolId, status: "ACTIVE" },
          select: { id: true },
        });

        if (activeYear) {
          throw new AcademicStructureError(
            "INVALID_STATE",
            "Clôturez l’année scolaire active avant d’en activer une autre.",
          );
        }
      }

      const updatedYear = await transaction.academicYear.update({
        where: { id: academicYear.id },
        data: { status: nextStatus },
        select: { id: true, status: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action:
          nextStatus === "ACTIVE"
            ? "ACADEMIC_YEAR_ACTIVATED"
            : "ACADEMIC_YEAR_CLOSED",
        entityType: "AcademicYear",
        entityId: academicYear.id,
        before: { status: academicYear.status },
        after: { status: updatedYear.status },
      });

      return updatedYear;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
