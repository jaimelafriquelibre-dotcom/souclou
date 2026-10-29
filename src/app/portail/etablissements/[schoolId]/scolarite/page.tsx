import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AcademicManagement } from "./academic-management";
import { PortalPageHeader } from "@/app/portail/page-header";
import { canUserPerformInSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type AcademicPageProps = {
  params: Promise<{ schoolId: string }>;
};

export default function AcademicPage({ params }: AcademicPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement de la structure scolaire…
        </main>
      }
    >
      <AcademicPageContent params={params} />
    </Suspense>
  );
}

async function AcademicPageContent({ params }: AcademicPageProps) {
  const userId = await requireActiveUserId();
  const { schoolId } = await params;
  const authorized = await canUserPerformInSchool(
    userId,
    schoolId,
    "manage_academic_structure",
  );

  if (!authorized) {
    notFound();
  }

  const [school, academicYears, classGroups] = await Promise.all([
    prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        countryCode: true,
        timeZone: true,
        organization: { select: { name: true } },
      },
    }),
    prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startsOn: "desc" },
      select: {
        id: true,
        label: true,
        startsOn: true,
        endsOn: true,
        status: true,
      },
    }),
    prisma.classGroup.findMany({
      where: { schoolId },
      orderBy: [{ academicYear: { startsOn: "desc" } }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        cycle: true,
        academicYear: { select: { id: true, label: true } },
      },
    }),
  ]);

  if (!school || school.countryCode !== "CI") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <PortalPageHeader
          description="Organisez les années et classes de l’établissement. Les dates sont saisies localement selon son calendrier scolaire."
          eyebrow={`${school.organization.name} · Côte d’Ivoire`}
          meta={`Fuseau horaire : ${school.timeZone}`}
          title={`Scolarité — ${school.name}`}
        />
        <AcademicManagement
          academicYears={academicYears}
          classGroups={classGroups}
          schoolId={schoolId}
        />
      </section>
    </main>
  );
}
