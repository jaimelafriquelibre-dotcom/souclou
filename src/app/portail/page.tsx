import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../auth";
import { PortalPageHeader } from "@/app/portail/page-header";
import { prisma } from "@/server/db";

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-16 text-slate-600"
          role="status"
        >
          Chargement de votre portail…
        </main>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

async function PortalContent() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.status !== "ACTIVE") {
    redirect("/en-attente");
  }

  const [
    schoolMemberships,
    organizationMemberships,
    teacherAssignmentSchoolIds,
    unreadNotifications,
  ] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        school: {
          status: "ACTIVE",
          organization: { status: "ACTIVE" },
        },
      },
      select: {
        role: true,
        school: {
          select: {
            id: true,
            name: true,
            organization: { select: { name: true } },
          },
        },
      },
    }),
    prisma.organizationMembership.findMany({
      where: {
        userId: session.user.id,
        role: "FOUNDER",
        status: "ACTIVE",
        organization: {
          status: "ACTIVE",
          schools: { some: { status: "ACTIVE" } },
        },
      },
      select: {
        organization: {
          select: {
            name: true,
            schools: {
              where: { status: "ACTIVE" },
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.classTeachingAssignment.findMany({
      where: {
        teacherUserId: session.user.id,
        classGroup: { academicYear: { status: "ACTIVE" } },
        school: {
          status: "ACTIVE",
          organization: { status: "ACTIVE" },
        },
      },
      select: { schoolId: true },
      distinct: ["schoolId"],
    }),
    prisma.notification.count({
      where: {
        userId: session.user.id,
        readAt: null,
        school: {
          status: "ACTIVE",
          organization: {
            status: "ACTIVE",
          },
          OR: [
            {
              memberships: {
                some: { userId: session.user.id, status: "ACTIVE" },
              },
            },
            {
              organization: {
                memberships: {
                  some: { userId: session.user.id, status: "ACTIVE" },
                },
              },
            },
          ],
        },
      },
    }),
  ]);

  const founderSchools = organizationMemberships.flatMap((membership) =>
    membership.organization.schools.map((school) => ({
      ...school,
      organizationName: membership.organization.name,
    })),
  );
  const schoolAccess = new Map<
    string,
    {
      id: string;
      name: string;
      organizationName: string;
      roles: Set<string>;
    }
  >();

  for (const school of founderSchools) {
    schoolAccess.set(school.id, {
      ...school,
      roles: new Set(["FOUNDER"]),
    });
  }
  for (const membership of schoolMemberships) {
    const school = schoolAccess.get(membership.school.id) ?? {
      ...membership.school,
      organizationName: membership.school.organization.name,
      roles: new Set<string>(),
    };
    school.roles.add(membership.role);
    schoolAccess.set(school.id, school);
  }

  const schoolsWithTeachingAssignments = new Set(
    teacherAssignmentSchoolIds.map(({ schoolId }) => schoolId),
  );
  const roleLabels: Record<string, string> = {
    FOUNDER: "Fondateur",
    STUDIES_DIRECTOR: "Direction des études",
    EDUCATOR: "Éducateur",
    ADMINISTRATIVE_STAFF: "Administration",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    GUARDIAN: "Parent / tuteur",
  };

  return (
    <main className="portal-page min-h-screen px-5 py-8 text-slate-950 sm:px-8 sm:py-12">
      <section className="portal-content mx-auto w-full max-w-5xl">
        <PortalPageHeader
          action={
            <Link className="portal-simple-notifications" href="/portail/notifications">
              Notifications
              {unreadNotifications > 0 ? (
                <span aria-label={`${unreadNotifications} notification(s) non lue(s)`}>
                  {unreadNotifications}
                </span>
              ) : null}
            </Link>
          }
          description="Choisissez un établissement pour retrouver les outils de votre quotidien."
          eyebrow="SOUCLOU · Espace de travail"
          title={`Bonjour${session.user.name ? `, ${session.user.name}` : ""}`}
        />

        {schoolAccess.size > 0 ? (
          <ul className="portal-simple-schools mt-8 grid grid-cols-1 gap-5">
            {[...schoolAccess.values()].map((school) => {
              const links = [
                {
                  show: true,
                  href: `/portail/etablissements/${school.id}/publications`,
                  label: "Publications",
                  tone: "teal",
                },
                {
                  show: school.roles.has("GUARDIAN"),
                  href: `/portail/etablissements/${school.id}/famille`,
                  label: "Espace famille",
                  tone: "rose",
                },
                {
                  show: ["FOUNDER", "STUDIES_DIRECTOR", "EDUCATOR"].some((role) =>
                    school.roles.has(role),
                  ),
                  href: `/portail/etablissements/${school.id}/comptes`,
                  label: "Gérer les accès",
                  tone: "violet",
                },
                {
                  show: ["FOUNDER", "STUDIES_DIRECTOR"].some((role) =>
                    school.roles.has(role),
                  ),
                  href: `/portail/etablissements/${school.id}/scolarite`,
                  label: "Scolarité",
                  tone: "amber",
                },
                {
                  show: [
                    "FOUNDER",
                    "STUDIES_DIRECTOR",
                    "ADMINISTRATIVE_STAFF",
                  ].some((role) => school.roles.has(role)),
                  href: `/portail/etablissements/${school.id}/eleves`,
                  label: "Inscriptions",
                  tone: "blue",
                },
                {
                  show:
                    ["FOUNDER", "STUDIES_DIRECTOR", "EDUCATOR"].some((role) =>
                      school.roles.has(role),
                    ) ||
                    (school.roles.has("TEACHER") &&
                      schoolsWithTeachingAssignments.has(school.id)),
                  href: `/portail/etablissements/${school.id}/presences`,
                  label: "Présences",
                  tone: "cyan",
                },
                {
                  show: [
                    "FOUNDER",
                    "STUDIES_DIRECTOR",
                    "ADMINISTRATIVE_STAFF",
                    "TEACHER",
                  ].some((role) => school.roles.has(role)),
                  href: `/portail/etablissements/${school.id}/pedagogie`,
                  label: "Outils pédagogiques",
                  tone: "pink",
                },
              ].filter((item) => item.show);

              return (
                <li className="portal-simple-school" key={school.id}>
                  <h2>{school.name}</h2>
                  <p className="portal-simple-organization">
                    {school.organizationName}
                  </p>
                  <p aria-label="Vos rôles" className="portal-simple-roles">
                    {[...school.roles]
                      .map((role) => roleLabels[role] ?? role)
                      .join(" · ")}
                  </p>
                  <ul className="portal-simple-modules">
                    {links.map((item) => (
                      <li key={item.href}>
                        <Link
                          className={`portal-simple-link portal-tone-${item.tone}`}
                          href={item.href}
                        >
                          {item.label}
                          <span aria-hidden="true">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="portal-simple-empty">
            <h2>Aucun établissement associé</h2>
            <p>
              Aucun établissement actif n’est encore associé à ce compte.
              Contactez votre responsable pour vérifier votre accès.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
