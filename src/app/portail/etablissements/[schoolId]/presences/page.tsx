import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttendanceManagement } from "./attendance-management";
import { PortalPageHeader } from "@/app/portail/page-header";
import { getIvoirianToday } from "@/lib/locale";
import {
  canUserPerformInSchool,
  canUserTeachClassUsing,
} from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type AttendancePageProps = {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{
    classId?: string | string[];
    date?: string | string[];
  }>;
};

export default function AttendancePage({
  params,
  searchParams,
}: AttendancePageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des présences…
        </main>
      }
    >
      <AttendancePageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AttendancePageContent({
  params,
  searchParams,
}: AttendancePageProps) {
  const userId = await requireActiveUserId();
  const [{ schoolId }, query] = await Promise.all([params, searchParams]);
  const canRecordForSchool = await canUserPerformInSchool(
    userId,
    schoolId,
    "record_attendance",
  );
  const teacherAssignments = canRecordForSchool
    ? []
    : await prisma.classTeachingAssignment.findMany({
        where: {
          schoolId,
          teacherUserId: userId,
          classGroup: { academicYear: { status: "ACTIVE" } },
        },
        select: { classGroupId: true },
        distinct: ["classGroupId"],
      });

  if (!canRecordForSchool && teacherAssignments.length === 0) {
    notFound();
  }

  const queryDate = typeof query.date === "string" ? query.date : undefined;
  const parsedDate = z.iso.date().safeParse(queryDate ?? getIvoirianToday());
  if (!parsedDate.success) {
    notFound();
  }
  const attendanceDate = parsedDate.data;

  const [school, classes] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        countryCode: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.classGroup.findMany({
      where: {
        schoolId,
        academicYear: { status: "ACTIVE" },
        ...(canRecordForSchool
          ? {}
          : { id: { in: teacherAssignments.map(({ classGroupId }) => classGroupId) } }),
      },
      orderBy: [{ academicYear: { startsOn: "desc" } }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        cycle: true,
        academicYear: { select: { label: true } },
      },
    }),
  ]);

  if (!school || school.countryCode !== "CI") {
    notFound();
  }

  const requestedClassId =
    typeof query.classId === "string" ? query.classId : undefined;
  const selectedClass = requestedClassId
    ? classes.find((classGroup) => classGroup.id === requestedClassId)
    : classes[0];

  if (requestedClassId && !selectedClass) {
    notFound();
  }

  if (
    selectedClass &&
    !canRecordForSchool &&
    !(await canUserTeachClassUsing(
      prisma,
      userId,
      schoolId,
      selectedClass.id,
    ))
  ) {
    notFound();
  }

  const entries = selectedClass
    ? await prisma.enrollment.findMany({
        where: {
          schoolId,
          classGroupId: selectedClass.id,
          academicYear: { status: "ACTIVE" },
          status: "ACTIVE",
          student: { status: "ACTIVE" },
        },
        orderBy: [
          { student: { familyName: "asc" } },
          { student: { givenNames: "asc" } },
          { id: "asc" },
        ],
        select: {
          id: true,
          student: { select: { familyName: true, givenNames: true } },
          attendanceRecords: {
            where: {
              attendanceDate: new Date(`${attendanceDate}T00:00:00.000Z`),
            },
            select: { status: true },
          },
        },
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <PortalPageHeader
          description="Les éducateurs et la direction peuvent saisir les présences des classes de leur établissement. Les enseignants peuvent saisir les présences des classes pour lesquelles ils ont une affectation active."
          eyebrow={`${school.organization.name} · Côte d’Ivoire`}
          title={`Présences — ${school.name}`}
        />
        <AttendanceManagement
          attendanceDate={attendanceDate}
          classes={classes}
          entries={entries}
          schoolId={schoolId}
          selectedClassId={selectedClass?.id ?? ""}
        />
      </section>
    </main>
  );
}
