import { Suspense } from "react";
import { connection } from "next/server";
import { PortalPageHeader } from "@/app/portail/page-header";
import { parseAuditPage } from "@/lib/audit-pagination";
import { parseAuditAction } from "@/lib/audit-filter";
import { prisma } from "@/server/db";
import { requireActiveUserId } from "@/server/session";

type AuditPageProps = { searchParams: Promise<{ schoolId?: string; action?: string; page?: string }> };
const PAGE_SIZE = 100;

export default function AuditPage({ searchParams }: AuditPageProps) {
  return <Suspense fallback={<main aria-busy="true" className="min-h-screen px-6 py-12" role="status">Chargement du journal...</main>}><AuditContent searchParams={searchParams} /></Suspense>;
}

async function AuditContent({ searchParams }: AuditPageProps) {
  await connection();
  const userId = await requireActiveUserId();
  const { schoolId, action: actionParam, page: pageParam } = await searchParams;
  const action = parseAuditAction(actionParam);
  const page = parseAuditPage(pageParam);
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId, role: "FOUNDER", status: "ACTIVE", organization: { status: "ACTIVE" } },
    select: { organizationId: true, organization: { select: { name: true, schools: { where: { status: "ACTIVE" }, select: { id: true, name: true } } } } },
  });
  const organizationIds = memberships.map(({ organizationId }) => organizationId);
  const schools = memberships.flatMap(({ organization }) => organization.schools);
  const selectedSchool = schoolId && schools.some((school) => school.id === schoolId) ? schoolId : undefined;
  const logs = organizationIds.length === 0 ? [] : await prisma.auditLog.findMany({
    where: { organizationId: { in: organizationIds }, ...(selectedSchool ? { schoolId: selectedSchool } : {}), ...(action ? { action } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE,
    select: { id: true, action: true, entityType: true, entityId: true, reason: true, createdAt: true, actor: { select: { name: true } }, school: { select: { name: true } } },
  });
  const hasNextPage = logs.length > PAGE_SIZE;
  const visibleLogs = logs.slice(0, PAGE_SIZE);
  const query = (targetPage: number) => new URLSearchParams({ ...(selectedSchool ? { schoolId: selectedSchool } : {}), ...(action ? { action } : {}), page: String(targetPage) }).toString();
  return <main className="portal-page min-h-screen px-5 py-8 text-slate-950 sm:px-8 sm:py-12"><section className="portal-content mx-auto w-full max-w-5xl"><PortalPageHeader eyebrow="SOUCLOU · Gouvernance" title="Journal d’audit" description="Consultez les opérations récentes de vos établissements. Les données sensibles des élèves ne sont pas exposées dans ce journal." /><form className="mt-8 flex flex-wrap items-end gap-3" method="get"><label className="grid gap-1 text-sm font-medium">Établissement<select className="rounded-lg border border-slate-300 bg-white px-3 py-2" defaultValue={selectedSchool ?? ""} name="schoolId"><option value="">Tous les établissements</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Action<input className="rounded-lg border border-slate-300 bg-white px-3 py-2" defaultValue={action ?? ""} maxLength={100} name="action" placeholder="Ex. SCHOOL_CREATED" /></label><button className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold" type="submit">Filtrer</button></form>{visibleLogs.length === 0 ? <p className="mt-8 text-sm text-slate-600">Aucune opération enregistrée dans ce périmètre.</p> : <ol className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">{visibleLogs.map((log) => <li className="flex flex-wrap justify-between gap-3 p-4" key={log.id}><div><p className="font-semibold">{log.action}</p><p className="text-sm text-slate-600">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""} · {log.school?.name ?? "Organisation"}</p>{log.reason ? <p className="text-sm text-slate-500">{log.reason}</p> : null}</div><div className="text-right text-xs text-slate-500"><p>{log.actor?.name ?? "Compte système"}</p><time dateTime={log.createdAt.toISOString()}>{new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(log.createdAt)}</time></div></li>)}</ol>}{visibleLogs.length > 0 ? <nav aria-label="Pagination du journal" className="mt-6 flex justify-between text-sm font-semibold">{page > 1 ? <a href={`/portail/audit?${query(page - 1)}`}>Précédent</a> : <span />}{hasNextPage ? <a href={`/portail/audit?${query(page + 1)}`}>Suivant</a> : <span />}</nav> : null}</section></main>;
}
