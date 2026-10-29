import { Suspense } from "react";
import { notFound } from "next/navigation";
import { StudentManagement } from "./student-management";
import { PortalPageHeader } from "@/app/portail/page-header";
import { canUserPerformInSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

const PAGE_SIZE = 50;

type StudentsPageProps = {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
  }>;
};

export default function StudentsPage({
  params,
  searchParams,
}: StudentsPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des inscriptions…
        </main>
      }
    >
      <StudentsPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function StudentsPageContent({
  params,
  searchParams,
}: StudentsPageProps) {
  const userId = await requireActiveUserId();
  const [{ schoolId }, query] = await Promise.all([params, searchParams]);
  const authorized = await canUserPerformInSchool(
    userId,
    schoolId,
    "manage_student_records",
  );

  if (!authorized) {
    notFound();
  }

  const requestedPage = typeof query.page === "string" ? Number(query.page) : 0;
  const currentPage =
    Number.isSafeInteger(requestedPage) && requestedPage >= 0
      ? requestedPage
      : 0;
  const statusFilter: "ACTIVE" | "ARCHIVED" =
    query.status === "archived" ? "ARCHIVED" : "ACTIVE";
  const studentWhere: { schoolId: string; status: "ACTIVE" | "ARCHIVED" } = {
    schoolId,
    status: statusFilter,
  };
  const [school, classes, totalStudents] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        countryCode: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.classGroup.findMany({
      where: { schoolId, academicYear: { status: "ACTIVE" } },
      orderBy: [{ academicYear: { startsOn: "desc" } }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        cycle: true,
        academicYear: { select: { label: true } },
      },
    }),
    prisma.student.count({ where: studentWhere }),
  ]);

  if (!school || school.countryCode !== "CI") {
    notFound();
  }

  const lastPage = Math.max(Math.ceil(totalStudents / PAGE_SIZE) - 1, 0);
  const safePage = Math.min(currentPage, lastPage);
  const studentPage = await prisma.student.findMany({
    where: studentWhere,
    orderBy: [{ familyName: "asc" }, { givenNames: "asc" }, { id: "asc" }],
    skip: safePage * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      status: true,
      localReference: true,
      familyName: true,
      givenNames: true,
      enrollments: {
        where: {
          status: { in: ["ACTIVE", "WITHDRAWN"] },
          academicYear: { status: "ACTIVE" },
        },
        take: 1,
        select: {
          id: true,
          status: true,
          classGroup: { select: { label: true, cycle: true } },
          academicYear: { select: { label: true } },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <PortalPageHeader
          description="Accès limité à la direction et au personnel administratif autorisé. Les informations collectées sont réduites au nom, aux prénoms et à une référence interne facultative."
          eyebrow={`${school.organization.name} · Côte d’Ivoire`}
          title={`Inscriptions — ${school.name}`}
        />
        <StudentManagement
          classes={classes}
          currentPage={safePage}
          hasNextPage={studentPage.length > PAGE_SIZE}
          schoolId={schoolId}
          statusFilter={statusFilter === "ARCHIVED" ? "archived" : "active"}
          students={studentPage.slice(0, PAGE_SIZE)}
          totalStudents={totalStudents}
        />
      </section>
    </main>
  );
}
