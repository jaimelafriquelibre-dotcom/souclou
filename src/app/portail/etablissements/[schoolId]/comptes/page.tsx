import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../../../../../auth";
import { AccountManagement } from "./account-management";
import { PortalPageHeader } from "@/app/portail/page-header";
import {
  canUserPerformInSchool,
  getInvitableSchoolRoles,
} from "@/server/permissions";
import { prisma } from "@/server/db";

type AccountsPageProps = {
  params: Promise<{ schoolId: string }>;
};

export default function SchoolAccountsPage({
  params,
}: AccountsPageProps) {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des accès…
        </main>
      }
    >
      <SchoolAccountsContent params={params} />
    </Suspense>
  );
}

async function SchoolAccountsContent({
  params,
}: AccountsPageProps) {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.status !== "ACTIVE") {
    redirect("/en-attente");
  }

  const { schoolId } = await params;
  const isAuthorized = await canUserPerformInSchool(
    session.user.id,
    schoolId,
    "approve_accounts",
  );

  if (!isAuthorized) {
    notFound();
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      name: true,
      status: true,
      organization: { select: { name: true, status: true } },
    },
  });

  if (
    !school ||
    school.status !== "ACTIVE" ||
    school.organization.status !== "ACTIVE"
  ) {
    notFound();
  }

  const [pendingMemberships, invitableRoles] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: { schoolId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { email: true, name: true } },
      },
    }),
    getInvitableSchoolRoles(session.user.id, schoolId),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-6xl">
        <PortalPageHeader
          description="Invitez des comptes par adresse e-mail et approuvez uniquement les appartenances de cet établissement. Les actions sont journalisées."
          eyebrow={school.organization.name}
          title={`Accès de ${school.name}`}
        />
        <AccountManagement
          invitableRoles={invitableRoles}
          pendingMemberships={pendingMemberships}
          schoolId={schoolId}
        />
      </section>
    </main>
  );
}
