import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicationManagement } from "./publication-management";
import { canUserPerformInSchool, canUserViewSchool } from "@/server/permissions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type PublicationApproverRole =
  | "STUDIES_DIRECTOR"
  | "EDUCATOR"
  | "ADMINISTRATIVE_STAFF";

type PublicationsPageProps = {
  params: Promise<{ schoolId: string }>;
};

export default function PublicationsPage(props: PublicationsPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des publications…
        </main>
      }
    >
      <PublicationsPageContent {...props} />
    </Suspense>
  );
}

async function PublicationsPageContent({ params }: PublicationsPageProps) {
  const userId = await requireActiveUserId();
  const { schoolId } = await params;
  if (!(await canUserViewSchool(userId, schoolId))) {
    notFound();
  }

  const [school, memberships, canManagePolicies, canCreatePublication] =
    await Promise.all([
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
      prisma.schoolMembership.findMany({
        where: {
          userId,
          schoolId,
          status: "ACTIVE",
          user: { status: "ACTIVE" },
        },
        select: { role: true },
      }),
      canUserPerformInSchool(userId, schoolId, "manage_publication_policies"),
      canUserPerformInSchool(userId, schoolId, "create_publication"),
    ]);

  if (!school) {
    notFound();
  }

  const memberRoles = [
    ...new Set(
      memberships
        .map(({ role }) => role)
        .filter(
          (role): role is
            | "STUDIES_DIRECTOR"
            | "EDUCATOR"
            | "ADMINISTRATIVE_STAFF" =>
            role === "STUDIES_DIRECTOR" ||
            role === "EDUCATOR" ||
            role === "ADMINISTRATIVE_STAFF",
        ),
    ),
  ];

  const [policies, publications] = await Promise.all([
    prisma.publicationPolicy.findMany({
      where: { schoolId },
      orderBy: { type: "asc" },
      select: {
        type: true,
        requiredApprovals: true,
        approverRoles: true,
      },
    }),
    prisma.publication.findMany({
      where: {
        schoolId,
        OR: [
          { status: "PUBLISHED" },
          ...(canCreatePublication
            ? [
                { status: "PENDING" as const, authorUserId: userId },
                { status: "REJECTED" as const, authorUserId: userId },
              ]
            : []),
          ...(memberRoles.length > 0
            ? [
                {
                  status: "PENDING" as const,
                  policy: { approverRoles: { hasSome: memberRoles } },
                },
              ]
            : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        authorUserId: true,
        title: true,
        body: true,
        status: true,
        createdAt: true,
        policy: { select: { requiredApprovals: true } },
        approvals: {
          select: { approverUserId: true, decision: true },
        },
      },
    }),
  ]);

  const safePolicies = policies.map((policy) => ({
    ...policy,
    approverRoles: policy.approverRoles.filter(
      (role): role is PublicationApproverRole =>
        role === "STUDIES_DIRECTOR" ||
        role === "EDUCATOR" ||
        role === "ADMINISTRATIVE_STAFF",
    ),
  }));

  const canApprovePublicationIds = publications
    .filter(
      (publication) =>
        publication.status === "PENDING" &&
        publication.authorUserId !== userId,
    )
    .map((publication) => publication.id);
  const safePublications = publications.map((publication) => ({
    id: publication.id,
    type: publication.type,
    title: publication.title,
    body: publication.body,
    status: publication.status,
    createdAt: publication.createdAt,
    policy: publication.policy,
    approvals: publication.approvals.map(({ decision }) => ({ decision })),
    hasDecided: publication.approvals.some(
      (approval) => approval.approverUserId === userId,
    ),
  }));

  return (
    <main className="publication-page min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8 sm:py-12">
      <section className="mx-auto w-full max-w-6xl">
        <Link className="publication-back-link" href="/portail">
          <span aria-hidden="true">←</span> Retour au portail
        </Link>
        <header className="portal-page-header publication-hero">
          <div className="publication-hero-copy">
            <p className="publication-eyebrow">
              {school.organization.name} <span>·</span> Côte d’Ivoire
            </p>
            <h1>Publications</h1>
            <p className="publication-school-name">{school.name}</p>
            <p className="publication-intro">
              Les avis et informations officielles ne sont diffusés aux familles
              qu’après les validations prévues par l’établissement.
            </p>
          </div>
          <div aria-hidden="true" className="publication-hero-art">
            <span className="publication-art-orbit publication-art-orbit-one" />
            <span className="publication-art-orbit publication-art-orbit-two" />
            <span className="publication-art-core">✦</span>
          </div>
          <span className="publication-governance-badge">
            <i /> Diffusion encadrée
          </span>
        </header>
        <PublicationManagement
          canApprovePublicationIds={canApprovePublicationIds}
          canCreatePublication={canCreatePublication}
          canManagePolicies={canManagePolicies}
          policies={safePolicies}
          publications={safePublications}
          schoolId={schoolId}
        />
      </section>
    </main>
  );
}
