import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PortalPageHeader } from "@/app/portail/page-header";
import { toggleSchoolStatusAction, updateSchoolSettingsAction } from "./actions";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";
import { canUserPerformInSchool } from "@/server/permissions";

type SchoolSettingsPageProps = { params: Promise<{ schoolId: string }> };

export default function SchoolSettingsPage({ params }: SchoolSettingsPageProps) {
  return (
    <Suspense fallback={<main aria-busy="true" className="min-h-screen px-6 py-12" role="status">Chargement des paramètres…</main>}>
      <SchoolSettingsContent params={params} />
    </Suspense>
  );
}

async function SchoolSettingsContent({ params }: SchoolSettingsPageProps) {
  const userId = await requireActiveUserId();
  const { schoolId } = await params;
  const school = await prisma.school.findFirst({
    where: { id: schoolId, organization: { status: "ACTIVE" } },
    select: { id: true, name: true, code: true, timeZone: true, status: true, organizationId: true, organization: { select: { name: true } } },
  });
  const founderMembership = school
    ? await prisma.organizationMembership.findFirst({
        where: { userId, organizationId: school.organizationId, role: "FOUNDER", status: "ACTIVE" },
        select: { id: true },
      })
    : null;
  const allowed = school?.status === "ACTIVE"
    ? await canUserPerformInSchool(userId, schoolId, "update_official_school_settings")
    : Boolean(founderMembership);
  if (!school || !allowed) notFound();

  return (
    <main className="portal-page min-h-screen px-5 py-8 text-slate-950 sm:px-8 sm:py-12">
      <section className="portal-content mx-auto w-full max-w-5xl">
        <PortalPageHeader eyebrow={school.organization.name} title={`Paramètres — ${school.name}`} description="Gérez les informations officielles et le fuseau horaire de cet établissement." />
        {school.status === "ACTIVE" ? <form action={updateSchoolSettingsAction} className="portal-form mt-8 grid max-w-2xl gap-5">
          <input name="schoolId" type="hidden" value={school.id} />
          <label>Nom de l’établissement<input defaultValue={school.name} name="name" required /></label>
          <label>Code interne<input defaultValue={school.code} name="code" pattern="[A-Za-z0-9_-]+" required /></label>
          <label>Fuseau horaire<input defaultValue={school.timeZone} name="timeZone" required /></label>
          <button className="portal-primary-button" type="submit">Enregistrer les paramètres</button>
        </form> : <p className="mt-8 text-sm text-amber-900">Cet établissement est suspendu. Réactivez-le pour modifier ses paramètres.</p>}
        <form action={toggleSchoolStatusAction} className="mt-8">
          <input name="schoolId" type="hidden" value={school.id} />
          <input name="status" type="hidden" value={school.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
          <button className="rounded-lg border border-amber-700 px-4 py-2 font-semibold text-amber-900" type="submit">
            {school.status === "ACTIVE" ? "Suspendre l’établissement" : "Réactiver l’établissement"}
          </button>
        </form>
      </section>
    </main>
  );
}
