import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { canUserPerformInSchoolUsing } from "@/server/permissions";

export type StudentRecordErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class StudentRecordError extends Error {
  constructor(
    readonly code: StudentRecordErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StudentRecordError";
  }
}

const enrollmentSchema = z.object({
  schoolId: z.string().min(1),
  classGroupId: z.string().min(1),
  localReference: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => value || null),
  familyName: z.string().trim().min(1).max(100),
  givenNames: z.string().trim().min(1).max(120),
});

const studentUpdateSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().min(1),
  localReference: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => value || null),
  familyName: z.string().trim().min(1).max(100),
  givenNames: z.string().trim().min(1).max(120),
});

async function requireStudentRecordAccess(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  schoolId: string,
) {
  const school = await transaction.school.findFirst({
    where: {
      id: schoolId,
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
    },
    select: { id: true, organizationId: true },
  });
  if (!school) {
    throw new StudentRecordError(
      "NOT_FOUND",
      "Établissement actif introuvable.",
    );
  }
  if (
    !(await canUserPerformInSchoolUsing(
      transaction,
      actorUserId,
      schoolId,
      "manage_student_records",
    ))
  ) {
    throw new StudentRecordError(
      "FORBIDDEN",
      "Vous n’êtes pas autorisé à gérer les inscriptions de cet établissement.",
    );
  }
  return school;
}

export async function enrollStudent(
  actorUserId: string,
  input: z.input<typeof enrollmentSchema>,
) {
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new StudentRecordError(
      "INVALID_INPUT",
      "Vérifiez les noms, la référence interne et la classe.",
    );
  }

  const { schoolId, classGroupId, localReference, familyName, givenNames } =
    parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireStudentRecordAccess(
        transaction,
        actorUserId,
        schoolId,
      );
      const classGroup = await transaction.classGroup.findFirst({
        where: {
          id: classGroupId,
          schoolId,
          academicYear: { status: "ACTIVE" },
        },
        select: { id: true, academicYearId: true },
      });
      if (!classGroup) {
        throw new StudentRecordError(
          "INVALID_STATE",
          "Choisissez une classe d’une année scolaire active de cet établissement.",
        );
      }

      if (localReference) {
        const existingStudent = await transaction.student.findUnique({
          where: { schoolId_localReference: { schoolId, localReference } },
          select: { id: true },
        });
        if (existingStudent) {
          throw new StudentRecordError(
            "ALREADY_EXISTS",
            "Cette référence interne est déjà utilisée dans l’établissement.",
          );
        }
      }

      const student = await transaction.student.create({
        data: { schoolId, localReference, familyName, givenNames },
        select: { id: true },
      });
      const enrollment = await transaction.enrollment.create({
        data: {
          studentId: student.id,
          schoolId,
          academicYearId: classGroup.academicYearId,
          classGroupId: classGroup.id,
        },
        select: { id: true },
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "STUDENT_ENROLLED",
        entityType: "Enrollment",
        entityId: enrollment.id,
        after: {
          studentId: student.id,
          enrollmentId: enrollment.id,
          academicYearId: classGroup.academicYearId,
          classGroupId: classGroup.id,
        },
      });
      return student;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateStudentRecord(
  actorUserId: string,
  input: z.input<typeof studentUpdateSchema>,
) {
  const parsed = studentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new StudentRecordError(
      "INVALID_INPUT",
      "Vérifiez les noms et la référence interne.",
    );
  }

  const { schoolId, studentId, familyName, givenNames, localReference } =
    parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireStudentRecordAccess(
        transaction,
        actorUserId,
        schoolId,
      );
      const student = await transaction.student.findFirst({
        where: { id: studentId, schoolId, status: "ACTIVE" },
        select: {
          id: true,
          familyName: true,
          givenNames: true,
          localReference: true,
        },
      });
      if (!student) {
        throw new StudentRecordError("NOT_FOUND", "Élève actif introuvable.");
      }

      if (localReference) {
        const duplicate = await transaction.student.findFirst({
          where: { schoolId, localReference, id: { not: studentId } },
          select: { id: true },
        });
        if (duplicate) {
          throw new StudentRecordError(
            "ALREADY_EXISTS",
            "Cette référence interne est déjà utilisée dans l’établissement.",
          );
        }
      }

      const changedFields = [
        ...(student.familyName !== familyName ? ["familyName"] : []),
        ...(student.givenNames !== givenNames ? ["givenNames"] : []),
        ...(student.localReference !== localReference ? ["localReference"] : []),
      ];
      if (changedFields.length === 0) {
        throw new StudentRecordError(
          "INVALID_STATE",
          "Aucune correction n’a été apportée.",
        );
      }

      await transaction.student.update({
        where: { id: student.id },
        data: { familyName, givenNames, localReference },
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "STUDENT_RECORD_CORRECTED",
        entityType: "Student",
        entityId: student.id,
        before: { changedFields },
        after: { changedFields },
      });
      return { id: student.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function archiveStudent(
  actorUserId: string,
  schoolId: string,
  studentId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireStudentRecordAccess(
        transaction,
        actorUserId,
        schoolId,
      );
      const student = await transaction.student.findFirst({
        where: { id: studentId, schoolId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!student) {
        throw new StudentRecordError("NOT_FOUND", "Élève actif introuvable.");
      }

      await transaction.student.update({
        where: { id: student.id },
        data: { status: "ARCHIVED" },
      });
      const [enrollments, guardianLinks] = await Promise.all([
        transaction.enrollment.updateMany({
          where: { studentId, schoolId, status: "ACTIVE" },
          data: { status: "WITHDRAWN" },
        }),
        transaction.guardianStudentLink.updateMany({
          where: {
            studentId,
            schoolId,
            status: { in: ["ACTIVE", "PENDING"] },
          },
          data: { status: "REJECTED" },
        }),
      ]);
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "STUDENT_ARCHIVED",
        entityType: "Student",
        entityId: student.id,
        after: {
          status: "ARCHIVED",
          withdrawnEnrollmentCount: enrollments.count,
          deactivatedGuardianLinkCount: guardianLinks.count,
        },
      });
      return { id: student.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function restoreStudent(
  actorUserId: string,
  schoolId: string,
  studentId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireStudentRecordAccess(
        transaction,
        actorUserId,
        schoolId,
      );
      const student = await transaction.student.findFirst({
        where: { id: studentId, schoolId, status: "ARCHIVED" },
        select: { id: true },
      });
      if (!student) {
        throw new StudentRecordError("NOT_FOUND", "Élève archivé introuvable.");
      }

      await transaction.student.update({
        where: { id: student.id },
        data: { status: "ACTIVE" },
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "STUDENT_RESTORED",
        entityType: "Student",
        entityId: student.id,
        after: { status: "ACTIVE" },
      });
      return { id: student.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setStudentEnrollmentStatus(
  actorUserId: string,
  schoolId: string,
  enrollmentId: string,
  status: "ACTIVE" | "WITHDRAWN",
) {
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireStudentRecordAccess(
        transaction,
        actorUserId,
        schoolId,
      );
      const enrollment = await transaction.enrollment.findFirst({
        where: {
          id: enrollmentId,
          schoolId,
          academicYear: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
        },
        select: { id: true, status: true },
      });
      if (!enrollment) {
        throw new StudentRecordError(
          "NOT_FOUND",
          "Inscription introuvable dans l’année scolaire active.",
        );
      }
      if (enrollment.status === status) {
        throw new StudentRecordError(
          "INVALID_STATE",
          status === "ACTIVE"
            ? "Cette inscription est déjà active."
            : "Cette inscription a déjà été retirée.",
        );
      }

      await transaction.enrollment.update({
        where: { id: enrollment.id },
        data: { status },
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action:
          status === "ACTIVE"
            ? "STUDENT_ENROLLMENT_REACTIVATED"
            : "STUDENT_ENROLLMENT_WITHDRAWN",
        entityType: "Enrollment",
        entityId: enrollment.id,
        before: { status: enrollment.status },
        after: { status },
      });
      return { id: enrollment.id, status };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
