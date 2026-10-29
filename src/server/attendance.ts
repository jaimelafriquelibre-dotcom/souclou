import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { canUserRecordAttendanceInClassUsing } from "@/server/permissions";

export type AttendanceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class AttendanceError extends Error {
  constructor(
    readonly code: AttendanceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AttendanceError";
  }
}

const attendanceSchema = z
  .object({
    schoolId: z.string().min(1),
    classGroupId: z.string().min(1),
    date: z.iso.date(),
    entries: z
      .array(
        z.object({
          enrollmentId: z.string().min(1),
          status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        }),
      )
      .min(1),
  })
  .refine(
    ({ entries }) =>
      new Set(entries.map((entry) => entry.enrollmentId)).size ===
      entries.length,
    "Un élève ne peut apparaître qu’une fois dans une feuille d’appel.",
  );

export async function recordClassAttendance(
  actorUserId: string,
  input: z.input<typeof attendanceSchema>,
) {
  const parsed = attendanceSchema.safeParse(input);

  if (!parsed.success) {
    throw new AttendanceError(
      "INVALID_INPUT",
      "Vérifiez la date et le statut de chaque élève.",
    );
  }

  const { schoolId, classGroupId, date, entries } = parsed.data;
  const attendanceDate = new Date(`${date}T00:00:00.000Z`);

  return prisma.$transaction(
    async (transaction) => {
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
        throw new AttendanceError(
          "NOT_FOUND",
          "Établissement actif introuvable.",
        );
      }

      const classGroup = await transaction.classGroup.findFirst({
        where: {
          id: classGroupId,
          schoolId,
          academicYear: { status: "ACTIVE" },
        },
        select: {
          id: true,
          academicYearId: true,
          academicYear: { select: { startsOn: true, endsOn: true } },
        },
      });

      if (!classGroup) {
        throw new AttendanceError(
          "NOT_FOUND",
          "Classe active introuvable dans cet établissement.",
        );
      }

      if (
        !(await canUserRecordAttendanceInClassUsing(
          transaction,
          actorUserId,
          schoolId,
          classGroup.id,
        ))
      ) {
        throw new AttendanceError(
          "FORBIDDEN",
          "Vous n’êtes pas autorisé à saisir les présences de cette classe.",
        );
      }

      const start = classGroup.academicYear.startsOn
        .toISOString()
        .slice(0, 10);
      const end = classGroup.academicYear.endsOn.toISOString().slice(0, 10);

      if (date < start || date > end) {
        throw new AttendanceError(
          "INVALID_STATE",
          "La date doit se situer dans les limites de l’année scolaire.",
        );
      }

      const enrollments = await transaction.enrollment.findMany({
        where: {
          schoolId,
          classGroupId,
          academicYearId: classGroup.academicYearId,
          status: "ACTIVE",
          student: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      const activeEnrollmentIds = new Set(
        enrollments.map((enrollment) => enrollment.id),
      );

      if (
        enrollments.length !== entries.length ||
        entries.some((entry) => !activeEnrollmentIds.has(entry.enrollmentId))
      ) {
        throw new AttendanceError(
          "INVALID_INPUT",
          "La liste contient un élève non inscrit dans cette classe.",
        );
      }

      const counts = {
        PRESENT: 0,
        ABSENT: 0,
        LATE: 0,
        EXCUSED: 0,
      };

      for (const entry of entries) {
        counts[entry.status] += 1;
        await transaction.attendanceRecord.upsert({
          where: {
            enrollmentId_attendanceDate: {
              enrollmentId: entry.enrollmentId,
              attendanceDate,
            },
          },
          create: {
            enrollmentId: entry.enrollmentId,
            schoolId,
            recordedByUserId: actorUserId,
            attendanceDate,
            status: entry.status,
          },
          update: {
            recordedByUserId: actorUserId,
            status: entry.status,
          },
        });
      }

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "CLASS_ATTENDANCE_RECORDED",
        entityType: "ClassGroup",
        entityId: classGroup.id,
        after: {
          academicYearId: classGroup.academicYearId,
          date,
          counts,
        },
      });

      return counts;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
