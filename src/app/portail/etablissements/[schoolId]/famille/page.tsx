import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PortalPageHeader } from "@/app/portail/page-header";
import { canUserViewSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type FamilyPageProps = {
  params: Promise<{ schoolId: string }>;
};

const attendanceLabels = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "En retard",
  EXCUSED: "Absence justifiée",
} as const;

export default function FamilyPage(props: FamilyPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement de l’espace famille…
        </main>
      }
    >
      <FamilyPageContent {...props} />
    </Suspense>
  );
}

async function FamilyPageContent({ params }: FamilyPageProps) {
  const userId = await requireActiveUserId();
  const { schoolId } = await params;
  const [canViewSchool, guardianMembership, school] = await Promise.all([
    canUserViewSchool(userId, schoolId),
    prisma.schoolMembership.findFirst({
      where: {
        userId,
        schoolId,
        role: "GUARDIAN",
        status: "ACTIVE",
        user: { status: "ACTIVE" },
      },
      select: { id: true },
    }),
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
  ]);
  if (!canViewSchool || !guardianMembership || !school) {
    notFound();
  }

  const links = await prisma.guardianStudentLink.findMany({
    where: {
      guardianUserId: userId,
      schoolId,
      status: "ACTIVE",
      student: {
        status: "ACTIVE",
        enrollments: {
          some: {
            schoolId,
            status: "ACTIVE",
            academicYear: { status: "ACTIVE" },
          },
        },
      },
    },
    orderBy: [{ student: { familyName: "asc" } }, { student: { givenNames: "asc" } }],
    select: {
      student: {
        select: {
          familyName: true,
          givenNames: true,
          enrollments: {
            where: {
              schoolId,
              status: "ACTIVE",
              academicYear: { status: "ACTIVE" },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              classGroup: { select: { label: true } },
              academicYear: { select: { label: true } },
              gradeEntries: {
                where: { schoolId },
                orderBy: [{ assessedOn: "desc" }, { createdAt: "desc" }],
                select: {
                  subject: true,
                  assessmentLabel: true,
                  assessedOn: true,
                  score: true,
                  maximumScore: true,
                },
              },
              attendanceRecords: {
                where: { schoolId },
                orderBy: { attendanceDate: "desc" },
                take: 20,
                select: { attendanceDate: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-5xl">
        <PortalPageHeader
          description="Consultez les informations scolaires des enfants rattachés à votre compte dans cet établissement."
          eyebrow={`${school.organization.name} · Côte d’Ivoire`}
          title={`Espace famille — ${school.name}`}
        />

        {links.length === 0 ? (
          <p className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
            Aucun élève n’est encore rattaché à ce compte pour l’année scolaire
            active. Contactez l’établissement pour demander le rattachement.
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            {links.map(({ student }, index) => {
              const enrollment = student.enrollments[0];
              return (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  key={`${student.familyName}-${student.givenNames}-${index}`}
                >
                  <h2 className="text-xl font-semibold">
                    {student.familyName} {student.givenNames}
                  </h2>
                  {enrollment ? (
                    <>
                      <p className="mt-1 text-sm text-slate-600">
                        {enrollment.classGroup.label} · {enrollment.academicYear.label}
                      </p>
                      <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <section>
                          <h3 className="font-semibold">Notes</h3>
                          {enrollment.gradeEntries.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-600">
                              Aucune note communiquée pour le moment.
                            </p>
                          ) : (
                            <ul className="mt-2 divide-y divide-slate-100">
                              {enrollment.gradeEntries.map((grade) => (
                                <li
                                  className="flex items-center justify-between gap-3 py-2 text-sm"
                                  key={`${grade.subject}-${grade.assessmentLabel}`}
                                >
                                  <span>
                                    {grade.subject} · {grade.assessmentLabel}
                                  </span>
                                  <span className="font-semibold">
                                    {grade.score.toString()}/
                                    {grade.maximumScore.toString()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                        <section>
                          <h3 className="font-semibold">Présences récentes</h3>
                          {enrollment.attendanceRecords.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-600">
                              Aucune présence enregistrée.
                            </p>
                          ) : (
                            <ul className="mt-2 divide-y divide-slate-100">
                              {enrollment.attendanceRecords.map((record) => (
                                <li
                                  className="flex items-center justify-between gap-3 py-2 text-sm"
                                  key={record.attendanceDate.toISOString()}
                                >
                                  <span>
                                    {new Intl.DateTimeFormat("fr-CI", {
                                      dateStyle: "long",
                                      timeZone: "Africa/Abidjan",
                                    }).format(record.attendanceDate)}
                                  </span>
                                  <span>{attendanceLabels[record.status]}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </section>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      Aucune inscription active n’est disponible pour l’année
                      scolaire en cours.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
