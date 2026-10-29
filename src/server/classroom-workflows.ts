import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { getIvoirianToday } from "@/lib/locale";
import { createInAppNotifications } from "@/server/notifications";
import {
  canUserPerformInSchoolUsing,
  canUserTeachClassUsing,
} from "@/server/permissions";

export type ClassroomWorkflowErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class ClassroomWorkflowError extends Error {
  constructor(
    readonly code: ClassroomWorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ClassroomWorkflowError";
  }
}

const guardianLinkSchema = z.object({
  schoolId: z.string().min(1),
  studentId: z.string().min(1),
  guardianEmail: z.string().trim().toLowerCase().email(),
});

const assignmentSchema = z.object({
  schoolId: z.string().min(1),
  classGroupId: z.string().min(1),
  teacherEmail: z.string().trim().toLowerCase().email(),
  subject: z.string().trim().min(1).max(80),
});

const gradeSchema = z
  .object({
    schoolId: z.string().min(1),
    assignmentId: z.string().min(1),
    enrollmentId: z.string().min(1),
    assessmentLabel: z.string().trim().min(1).max(120),
    score: z.number().finite().min(0),
    maximumScore: z.number().finite().gt(0),
    assessedOn: z.iso.date(),
  })
  .refine(({ score, maximumScore }) => score <= maximumScore);

const gradeCorrectionSchema = z
  .object({
    gradeId: z.string().min(1),
    schoolId: z.string().min(1),
    assessmentLabel: z.string().trim().min(1).max(120),
    score: z.number().finite().min(0),
    maximumScore: z.number().finite().gt(0),
    assessedOn: z.iso.date(),
  })
  .refine(({ score, maximumScore }) => score <= maximumScore);

const timetableSchema = z
  .object({
    schoolId: z.string().min(1),
    assignmentId: z.string().min(1),
    weekday: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ]),
    startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .refine(({ startsAt, endsAt }) => startsAt < endsAt);

async function requireSchoolPermission(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  schoolId: string,
  permission:
    | "manage_guardian_links"
    | "approve_guardian_links"
    | "manage_teaching_assignments",
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
    throw new ClassroomWorkflowError(
      "NOT_FOUND",
      "Établissement actif introuvable.",
    );
  }

  if (
    !(await canUserPerformInSchoolUsing(
      transaction,
      actorUserId,
      schoolId,
      permission,
    ))
  ) {
    throw new ClassroomWorkflowError(
      "FORBIDDEN",
      "Vous n’êtes pas autorisé à effectuer cette action.",
    );
  }

  return school;
}

export async function createGuardianStudentLink(
  actorUserId: string,
  input: z.input<typeof guardianLinkSchema>,
) {
  const parsed = guardianLinkSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClassroomWorkflowError("INVALID_INPUT", "Vérifiez les données.");
  }

  const { schoolId, studentId, guardianEmail } = parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolPermission(
        transaction,
        actorUserId,
        schoolId,
        "manage_guardian_links",
      );
      const guardian = await transaction.user.findFirst({
        where: {
          emailNormalized: guardianEmail,
          status: "ACTIVE",
          schoolMemberships: {
            some: { schoolId, role: "GUARDIAN", status: "ACTIVE" },
          },
        },
        select: { id: true },
      });
      const student = await transaction.student.findFirst({
        where: {
          id: studentId,
          schoolId,
          status: "ACTIVE",
          enrollments: {
            some: {
              schoolId,
              status: "ACTIVE",
              academicYear: { status: "ACTIVE" },
            },
          },
        },
        select: { id: true },
      });

      if (!guardian || !student) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Compte parent actif ou élève introuvable dans cet établissement.",
        );
      }

      const existing = await transaction.guardianStudentLink.findUnique({
        where: {
          guardianUserId_studentId: {
            guardianUserId: guardian.id,
            studentId: student.id,
          },
        },
        select: { id: true, status: true },
      });

      if (existing?.status === "ACTIVE" || existing?.status === "PENDING") {
        throw new ClassroomWorkflowError(
          "ALREADY_EXISTS",
          "Ce lien parent-élève est déjà actif ou en attente.",
        );
      }

      const link = existing
        ? await transaction.guardianStudentLink.update({
            where: { id: existing.id },
            data: { status: "PENDING" },
            select: { id: true },
          })
        : await transaction.guardianStudentLink.create({
            data: {
              guardianUserId: guardian.id,
              studentId: student.id,
              schoolId,
            },
            select: { id: true },
          });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "GUARDIAN_LINK_REQUESTED",
        entityType: "GuardianStudentLink",
        entityId: link.id,
        after: { studentId, status: "PENDING" },
      });

      return link;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function decideGuardianStudentLink(
  actorUserId: string,
  schoolId: string,
  linkId: string,
  decision: "ACTIVE" | "REJECTED",
) {
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolPermission(
        transaction,
        actorUserId,
        schoolId,
        "approve_guardian_links",
      );
      const link = await transaction.guardianStudentLink.findFirst({
        where: { id: linkId, schoolId },
        select: {
          id: true,
          guardianUserId: true,
          studentId: true,
          status: true,
        },
      });

      if (!link) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Demande parent-élève introuvable.",
        );
      }
      if (link.status !== "PENDING") {
        throw new ClassroomWorkflowError(
          "INVALID_STATE",
          "Cette demande a déjà été traitée.",
        );
      }

      if (decision === "ACTIVE") {
        const [guardian, enrollment] = await Promise.all([
          transaction.user.findFirst({
            where: {
              id: link.guardianUserId,
              status: "ACTIVE",
              schoolMemberships: {
                some: { schoolId, role: "GUARDIAN", status: "ACTIVE" },
              },
            },
            select: { id: true },
          }),
          transaction.enrollment.findFirst({
            where: {
              studentId: link.studentId,
              schoolId,
              status: "ACTIVE",
              academicYear: { status: "ACTIVE" },
              student: { status: "ACTIVE" },
            },
            select: { id: true },
          }),
        ]);
        if (!guardian || !enrollment) {
          throw new ClassroomWorkflowError(
            "INVALID_STATE",
            "Le compte parent ou l’inscription de l’élève n’est plus actif.",
          );
        }
      }

      const updated = await transaction.guardianStudentLink.update({
        where: { id: link.id },
        data: { status: decision },
        select: { id: true, status: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action:
          decision === "ACTIVE"
            ? "GUARDIAN_LINK_APPROVED"
            : "GUARDIAN_LINK_REJECTED",
        entityType: "GuardianStudentLink",
        entityId: link.id,
        before: { status: link.status },
        after: { status: updated.status },
      });
      await createInAppNotifications(transaction, {
        schoolId,
        userIds: [link.guardianUserId],
        type: "GUARDIAN_LINK_DECISION",
        title:
          decision === "ACTIVE"
            ? "Rattachement parent-élève approuvé"
            : "Rattachement parent-élève refusé",
        body:
          decision === "ACTIVE"
            ? "L’accès aux informations scolaires de l’élève est activé."
            : "La demande de rattachement n’a pas été approuvée.",
        href: `/portail/etablissements/${schoolId}/famille`,
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function assignTeacherToClass(
  actorUserId: string,
  input: z.input<typeof assignmentSchema>,
) {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClassroomWorkflowError(
      "INVALID_INPUT",
      "Vérifiez le courriel, la classe et la matière.",
    );
  }

  const { schoolId, classGroupId, teacherEmail, subject } = parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolPermission(
        transaction,
        actorUserId,
        schoolId,
        "manage_teaching_assignments",
      );
      const classGroup = await transaction.classGroup.findFirst({
        where: { id: classGroupId, schoolId, academicYear: { status: { not: "CLOSED" } } },
        select: { id: true, academicYearId: true },
      });
      const teacher = await transaction.user.findFirst({
        where: {
          emailNormalized: teacherEmail,
          status: "ACTIVE",
          schoolMemberships: {
            some: { schoolId, role: "TEACHER", status: "ACTIVE" },
          },
        },
        select: { id: true },
      });

      if (!classGroup || !teacher) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Classe ou compte enseignant actif introuvable dans cet établissement.",
        );
      }

      const existing = await transaction.classTeachingAssignment.findUnique({
        where: {
          teacherUserId_classGroupId_subject: {
            teacherUserId: teacher.id,
            classGroupId,
            subject,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ClassroomWorkflowError(
          "ALREADY_EXISTS",
          "Cet enseignant est déjà affecté à cette matière et cette classe.",
        );
      }

      const assignment = await transaction.classTeachingAssignment.create({
        data: {
          teacherUserId: teacher.id,
          schoolId,
          academicYearId: classGroup.academicYearId,
          classGroupId,
          subject,
        },
        select: { id: true, subject: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "TEACHER_ASSIGNED_TO_CLASS",
        entityType: "ClassTeachingAssignment",
        entityId: assignment.id,
        after: { classGroupId, subject: assignment.subject },
      });

      return assignment;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordGrade(
  actorUserId: string,
  input: z.input<typeof gradeSchema>,
) {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClassroomWorkflowError(
      "INVALID_INPUT",
      "Vérifiez l’évaluation et la note. La note doit être comprise entre zéro et le barème.",
    );
  }

  const {
    schoolId,
    assignmentId,
    enrollmentId,
    assessmentLabel,
    score,
    maximumScore,
    assessedOn,
  } = parsed.data;
  const date = assessedOn;
  const today = getIvoirianToday();

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
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Établissement actif introuvable.",
        );
      }

      const assignment =
        await transaction.classTeachingAssignment.findFirst({
          where: {
            id: assignmentId,
            schoolId,
            classGroup: { academicYear: { status: "ACTIVE" } },
          },
          select: {
            id: true,
            teacherUserId: true,
            classGroupId: true,
            academicYearId: true,
            subject: true,
            classGroup: {
              select: {
                academicYear: { select: { startsOn: true, endsOn: true } },
              },
            },
          },
        });
      if (!assignment) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Affectation pédagogique active introuvable.",
        );
      }

      const yearStart = assignment.classGroup.academicYear.startsOn
        .toISOString()
        .slice(0, 10);
      const yearEnd = assignment.classGroup.academicYear.endsOn
        .toISOString()
        .slice(0, 10);
      if (date < yearStart || date > yearEnd || date > today) {
        throw new ClassroomWorkflowError(
          "INVALID_STATE",
          "La date d’évaluation doit se situer dans l’année scolaire et ne pas être future.",
        );
      }

      const isDirector = await canUserPerformInSchoolUsing(
        transaction,
        actorUserId,
        schoolId,
        "manage_academic_structure",
      );
      if (
        !isDirector &&
        (assignment.teacherUserId !== actorUserId ||
          !(await canUserTeachClassUsing(
            transaction,
            actorUserId,
            schoolId,
            assignment.classGroupId,
          )))
      ) {
        throw new ClassroomWorkflowError(
          "FORBIDDEN",
          "Seul l’enseignant affecté ou la direction peut saisir cette note.",
        );
      }

      const enrollment = await transaction.enrollment.findFirst({
        where: {
          id: enrollmentId,
          schoolId,
          classGroupId: assignment.classGroupId,
          academicYearId: assignment.academicYearId,
          status: "ACTIVE",
          student: { status: "ACTIVE" },
        },
        select: { id: true },
      });
      if (!enrollment) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Élève non inscrit dans la classe de cette matière.",
        );
      }

      const existing = await transaction.gradeEntry.findUnique({
        where: {
          enrollmentId_subject_assessmentLabel: {
            enrollmentId,
            subject: assignment.subject,
            assessmentLabel,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ClassroomWorkflowError(
          "ALREADY_EXISTS",
          "Une note existe déjà pour cet élève et cette évaluation.",
        );
      }

      const grade = await transaction.gradeEntry.create({
        data: {
          enrollmentId,
          schoolId,
          classGroupId: assignment.classGroupId,
          academicYearId: assignment.academicYearId,
          assignmentId: assignment.id,
          recordedByUserId: actorUserId,
          subject: assignment.subject,
          assessmentLabel,
          score,
          maximumScore,
          assessedOn: new Date(`${assessedOn}T00:00:00.000Z`),
        },
        select: { id: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "GRADE_RECORDED",
        entityType: "GradeEntry",
        entityId: grade.id,
        after: {
          enrollmentId,
          classGroupId: assignment.classGroupId,
          subject: assignment.subject,
          assessmentLabel,
        },
      });

      return grade;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function correctGrade(
  actorUserId: string,
  input: z.input<typeof gradeCorrectionSchema>,
) {
  const parsed = gradeCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClassroomWorkflowError(
      "INVALID_INPUT",
      "Vérifiez l’évaluation et la note. La note doit être comprise entre zéro et le barème.",
    );
  }

  const { gradeId, schoolId, assessmentLabel, score, maximumScore, assessedOn } =
    parsed.data;
  const today = getIvoirianToday();

  return prisma.$transaction(
    async (transaction) => {
      const grade = await transaction.gradeEntry.findFirst({
        where: {
          id: gradeId,
          schoolId,
          classGroup: { academicYear: { status: "ACTIVE" } },
          enrollment: {
            status: "ACTIVE",
            student: { status: "ACTIVE" },
          },
        },
        select: {
          id: true,
          enrollmentId: true,
          classGroupId: true,
          academicYearId: true,
          assignmentId: true,
          subject: true,
          assessmentLabel: true,
          score: true,
          maximumScore: true,
          assessedOn: true,
          assignment: { select: { teacherUserId: true } },
          classGroup: {
            select: {
              academicYear: { select: { startsOn: true, endsOn: true } },
            },
          },
        },
      });

      if (!grade) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Note active introuvable dans cet établissement.",
        );
      }

      const school = await transaction.school.findFirst({
        where: {
          id: schoolId,
          status: "ACTIVE",
          organization: { status: "ACTIVE" },
        },
        select: { organizationId: true },
      });
      if (!school) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Établissement actif introuvable.",
        );
      }

      const isDirector = await canUserPerformInSchoolUsing(
        transaction,
        actorUserId,
        schoolId,
        "manage_academic_structure",
      );
      if (
        !isDirector &&
        (grade.assignment.teacherUserId !== actorUserId ||
          !(await canUserTeachClassUsing(
            transaction,
            actorUserId,
            schoolId,
            grade.classGroupId,
          )))
      ) {
        throw new ClassroomWorkflowError(
          "FORBIDDEN",
          "Seul l’enseignant affecté ou la direction peut corriger cette note.",
        );
      }

      const yearStart = grade.classGroup.academicYear.startsOn
        .toISOString()
        .slice(0, 10);
      const yearEnd = grade.classGroup.academicYear.endsOn
        .toISOString()
        .slice(0, 10);
      if (assessedOn < yearStart || assessedOn > yearEnd || assessedOn > today) {
        throw new ClassroomWorkflowError(
          "INVALID_STATE",
          "La date d’évaluation doit se situer dans l’année scolaire et ne pas être future.",
        );
      }

      const duplicate = await transaction.gradeEntry.findFirst({
        where: {
          enrollmentId: grade.enrollmentId,
          subject: grade.subject,
          assessmentLabel,
          id: { not: grade.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ClassroomWorkflowError(
          "ALREADY_EXISTS",
          "Une note existe déjà pour cet élève et cette évaluation.",
        );
      }

      const updatedGrade = await transaction.gradeEntry.update({
        where: { id: grade.id },
        data: {
          assessmentLabel,
          score,
          maximumScore,
          assessedOn: new Date(`${assessedOn}T00:00:00.000Z`),
          recordedByUserId: actorUserId,
        },
        select: { id: true },
      });

      const changedFields = [
        ...(grade.assessmentLabel !== assessmentLabel ? ["assessmentLabel"] : []),
        ...(Number(grade.score) !== score ? ["score"] : []),
        ...(Number(grade.maximumScore) !== maximumScore
          ? ["maximumScore"]
          : []),
        ...(grade.assessedOn.toISOString().slice(0, 10) !== assessedOn
          ? ["assessedOn"]
          : []),
      ];

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "GRADE_CORRECTED",
        entityType: "GradeEntry",
        entityId: updatedGrade.id,
        after: { changedFields },
      });

      return updatedGrade;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createTimetableSlot(
  actorUserId: string,
  input: z.input<typeof timetableSchema>,
) {
  const parsed = timetableSchema.safeParse(input);
  if (!parsed.success) {
    throw new ClassroomWorkflowError(
      "INVALID_INPUT",
      "Vérifiez le jour et les horaires du cours.",
    );
  }

  const { schoolId, assignmentId, weekday, startsAt, endsAt } = parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireSchoolPermission(
        transaction,
        actorUserId,
        schoolId,
        "manage_teaching_assignments",
      );
      const assignment =
        await transaction.classTeachingAssignment.findFirst({
          where: {
            id: assignmentId,
            schoolId,
            classGroup: { academicYear: { status: { not: "CLOSED" } } },
          },
          select: {
            id: true,
            teacherUserId: true,
            classGroupId: true,
            academicYearId: true,
            subject: true,
          },
        });
      if (!assignment) {
        throw new ClassroomWorkflowError(
          "NOT_FOUND",
          "Affectation pédagogique introuvable.",
        );
      }

      const overlap = await transaction.timetableSlot.findFirst({
        where: {
          schoolId,
          academicYearId: assignment.academicYearId,
          weekday,
          OR: [
            {
              classGroupId: assignment.classGroupId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            {
              teacherUserId: assignment.teacherUserId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          ],
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ClassroomWorkflowError(
          "INVALID_STATE",
          "Ce créneau chevauche déjà un cours de la classe ou de l’enseignant.",
        );
      }

      const slot = await transaction.timetableSlot.create({
        data: {
          schoolId,
          academicYearId: assignment.academicYearId,
          classGroupId: assignment.classGroupId,
          assignmentId: assignment.id,
          teacherUserId: assignment.teacherUserId,
          subject: assignment.subject,
          weekday,
          startsAt,
          endsAt,
        },
        select: { id: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "TIMETABLE_SLOT_CREATED",
        entityType: "TimetableSlot",
        entityId: slot.id,
        after: {
          classGroupId: assignment.classGroupId,
          subject: assignment.subject,
          weekday,
          startsAt,
          endsAt,
        },
      });

      return slot;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
