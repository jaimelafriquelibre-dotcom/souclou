import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PedagogyManagement } from "./pedagogy-management";
import { PortalPageHeader } from "@/app/portail/page-header";
import { getIvoirianToday } from "@/lib/locale";
import { canUserPerformInSchool, canUserViewSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type PedagogyPageProps = {
  params: Promise<{ schoolId: string }>;
};

export default function PedagogyPage(props: PedagogyPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des outils pédagogiques…
        </main>
      }
    >
      <PedagogyPageContent {...props} />
    </Suspense>
  );
}

async function PedagogyPageContent({ params }: PedagogyPageProps) {
  const userId = await requireActiveUserId();
  const { schoolId } = await params;
  if (!(await canUserViewSchool(userId, schoolId))) {
    notFound();
  }

  const [
    school,
    canManageAssignments,
    canManageGuardianLinks,
    canApproveGuardianLinks,
  ] = await Promise.all([
    prisma.school.findFirst({
      where: {
        id: schoolId,
        countryCode: "CI",
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      select: {
        name: true,
        organization: { select: { name: true } },
      },
    }),
    canUserPerformInSchool(userId, schoolId, "manage_teaching_assignments"),
    canUserPerformInSchool(userId, schoolId, "manage_guardian_links"),
    canUserPerformInSchool(userId, schoolId, "approve_guardian_links"),
  ]);
  if (!school) {
    notFound();
  }

  const assignments = await prisma.classTeachingAssignment.findMany({
    where: {
      schoolId,
      classGroup: { academicYear: { status: "ACTIVE" } },
      ...(canManageAssignments ? {} : { teacherUserId: userId }),
    },
    orderBy: [{ classGroup: { label: "asc" } }, { subject: "asc" }],
    select: {
      id: true,
      classGroupId: true,
      subject: true,
      teacherUserId: true,
      teacher: { select: { name: true, email: true } },
      classGroup: { select: { label: true } },
    },
  });
  const classGroupIds = [
    ...new Set(assignments.map((assignment) => assignment.classGroupId)),
  ];

  const [classes, students, teachers, pendingLinks, gradeRows, timetableRows] =
    await Promise.all([
      canManageAssignments
        ? prisma.classGroup.findMany({
            where: { schoolId, academicYear: { status: "ACTIVE" } },
            orderBy: { label: "asc" },
            select: { id: true, label: true },
          })
        : Promise.resolve([]),
      prisma.enrollment.findMany({
        where: {
          schoolId,
          ...(canManageAssignments || canManageGuardianLinks
            ? {}
            : { classGroupId: { in: classGroupIds } }),
          academicYear: { status: "ACTIVE" },
          status: "ACTIVE",
          student: { status: "ACTIVE" },
        },
        orderBy: [
          { student: { familyName: "asc" } },
          { student: { givenNames: "asc" } },
        ],
        select: {
          id: true,
          studentId: true,
          classGroupId: true,
          student: { select: { familyName: true, givenNames: true } },
          classGroup: { select: { label: true } },
        },
      }),
      canManageAssignments
        ? prisma.user.findMany({
            where: {
              status: "ACTIVE",
              schoolMemberships: {
                some: {
                  schoolId,
                  role: "TEACHER",
                  status: "ACTIVE",
                },
              },
            },
            orderBy: [{ name: "asc" }, { email: "asc" }],
            select: { name: true, email: true },
          })
        : Promise.resolve([]),
      canApproveGuardianLinks
        ? prisma.guardianStudentLink.findMany({
            where: {
              schoolId,
              status: "PENDING",
              guardian: {
                status: "ACTIVE",
                schoolMemberships: {
                  some: {
                    schoolId,
                    role: "GUARDIAN",
                    status: "ACTIVE",
                  },
                },
              },
              student: {
                status: "ACTIVE",
                enrollments: {
                  some: {
                    schoolId,
                    status: "ACTIVE",
                    classGroup: { academicYear: { status: "ACTIVE" } },
                  },
                },
              },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              guardian: { select: { name: true, email: true } },
              student: {
                select: {
                  familyName: true,
                  givenNames: true,
                  enrollments: {
                    where: {
                      status: "ACTIVE",
                      classGroup: { academicYear: { status: "ACTIVE" } },
                    },
                    select: { classGroup: { select: { label: true } } },
                    take: 1,
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      classGroupIds.length > 0
        ? prisma.gradeEntry.findMany({
            where: {
              schoolId,
              classGroup: { academicYear: { status: "ACTIVE" } },
              classGroupId: { in: classGroupIds },
              ...(canManageAssignments
                ? {}
                : { assignment: { teacherUserId: userId } }),
            },
            orderBy: [{ assessedOn: "desc" }, { createdAt: "desc" }],
            take: 100,
            select: {
              id: true,
              subject: true,
              assessmentLabel: true,
              assessedOn: true,
              score: true,
              maximumScore: true,
              enrollment: {
                select: {
                  student: { select: { familyName: true, givenNames: true } },
                  classGroup: { select: { label: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      classGroupIds.length > 0
        ? prisma.timetableSlot.findMany({
            where: {
              schoolId,
              classGroup: { academicYear: { status: "ACTIVE" } },
              classGroupId: { in: classGroupIds },
              ...(canManageAssignments
                ? {}
                : { assignmentId: { in: assignments.map(({ id }) => id) } }),
            },
            orderBy: [{ weekday: "asc" }, { startsAt: "asc" }],
            select: {
              id: true,
              weekday: true,
              startsAt: true,
              endsAt: true,
              subject: true,
              classGroup: { select: { label: true } },
              teacher: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

  const studentOptions = students.map((enrollment) => ({
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    studentName: `${enrollment.student.familyName} ${enrollment.student.givenNames}`,
    classGroupId: enrollment.classGroupId,
    classLabel: enrollment.classGroup.label,
  }));
  const canRecordGrades = canManageAssignments || assignments.length > 0;
  const hasAnyFeature =
    canManageAssignments ||
    canManageGuardianLinks ||
    canApproveGuardianLinks ||
    canRecordGrades;
  if (!hasAnyFeature) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <PortalPageHeader
          description="Gérez les rattachements familiaux, les affectations, les notes et les emplois du temps selon les droits de votre compte."
          eyebrow={`${school.organization.name} · Côte d’Ivoire`}
          title={`Pédagogie — ${school.name}`}
        />
        <PedagogyManagement
          assignments={assignments.map((assignment) => ({
            id: assignment.id,
            classGroupId: assignment.classGroupId,
            classLabel: assignment.classGroup.label,
            subject: assignment.subject,
            teacherName: assignment.teacher.name,
            teacherEmail: assignment.teacher.email,
          }))}
          canApproveGuardianLinks={canApproveGuardianLinks}
          canManageAssignments={canManageAssignments}
          canManageGuardianLinks={canManageGuardianLinks}
          canRecordGrades={canRecordGrades}
          classes={classes}
          grades={gradeRows.map((grade) => ({
            id: grade.id,
            subject: grade.subject,
            assessmentLabel: grade.assessmentLabel,
            assessedOn: grade.assessedOn,
            score: grade.score.toString(),
            maximumScore: grade.maximumScore.toString(),
            studentName: `${grade.enrollment.student.familyName} ${grade.enrollment.student.givenNames}`,
            classLabel: grade.enrollment.classGroup.label,
          }))}
          pendingLinks={pendingLinks.map((link) => ({
            id: link.id,
            guardianName: link.guardian.name,
            guardianEmail: link.guardian.email,
            studentName: `${link.student.familyName} ${link.student.givenNames}`,
            classLabel:
              link.student.enrollments[0]?.classGroup.label ?? "Classe inconnue",
          }))}
          schoolId={schoolId}
          students={studentOptions}
          teachers={teachers}
          timetable={timetableRows.map((slot) => ({
            ...slot,
            classLabel: slot.classGroup.label,
            teacherName: slot.teacher.name,
          }))}
          today={getIvoirianToday()}
        />
      </section>
    </main>
  );
}
