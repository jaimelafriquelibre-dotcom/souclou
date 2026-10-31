import { Suspense } from "react";
import { connection } from "next/server";
import { PortalPageHeader } from "@/app/portail/page-header";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";
import { assignTechnicalAdminAction, setTechnicalAdminStatusAction } from "./actions";

export default function OrganizationPage() {
  return <Suspense fallback={<main aria-busy="true" className="min-h-screen px-6 py-12" role="status">Chargement de la gouvernance…</main>}><OrganizationContent /></Suspense>;
}

async function OrganizationContent() {
  await connection();
  const userId = await requireActiveUserId();
  const organizations = await prisma.organizationMembership.findMany({
    where: { userId, role: "FOUNDER", status: "ACTIVE", organization: { status: "ACTIVE" } },
    select: { organizationId: true, organization: { select: { name: true, memberships: { where: { role: "TECHNICAL_ADMIN", status: { in: ["ACTIVE", "SUSPENDED"] } }, select: { id: true, role: true, status: true, user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } } } } },
  });
  return <main className="portal-page min-h-screen px-5 py-8 text-slate-950 sm:px-8 sm:py-12"><section className="portal-content mx-auto w-full max-w-5xl"><PortalPageHeader eyebrow="SOUCLOU · Gouvernance" title="Organisations" description="Gérez les administrateurs techniques de vos organisations." />{organizations.map(({ organizationId, organization }) => <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" key={organizationId}><h2 className="text-xl font-semibold">{organization.name}</h2><form action={assignTechnicalAdminAction} className="mt-5 flex flex-wrap gap-3"><input name="organizationId" type="hidden" value={organizationId} /><input className="rounded-lg border border-slate-300 px-3 py-2" name="userEmail" placeholder="email du compte actif" required type="email" /><button className="portal-primary-button" type="submit">Attribuer administrateur technique</button></form><ul className="mt-5 divide-y divide-slate-200">{organization.memberships.map((membership) => <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm" key={membership.id}><span>{membership.user.name ?? membership.user.email} · {membership.role} · {membership.status === "ACTIVE" ? "Actif" : "Suspendu"}</span><form action={setTechnicalAdminStatusAction}><input name="organizationId" type="hidden" value={organizationId} /><input name="membershipId" type="hidden" value={membership.id} /><input name="status" type="hidden" value={membership.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} /><button className="rounded border border-amber-700 px-2 py-1 text-xs font-semibold text-amber-900" type="submit">{membership.status === "ACTIVE" ? "Suspendre" : "Réactiver"}</button></form></li>)}</ul></section>)}</section></main>;
}
