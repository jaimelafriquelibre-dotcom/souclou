import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { canManageOrganizationMembership } from "@/lib/organization-governance-rules";

const governanceInput = z.object({ organizationId: z.string().min(1), userEmail: z.string().trim().email() });

export class OrganizationGovernanceError extends Error {}

export async function setTechnicalAdminStatus(actorUserId: string, organizationId: string, membershipId: string, status: "ACTIVE" | "SUSPENDED") {
  return prisma.$transaction(async (transaction) => {
    const founder = await transaction.organizationMembership.findFirst({ where: { userId: actorUserId, organizationId, role: "FOUNDER", status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { id: true } });
    if (!founder) throw new OrganizationGovernanceError("Seul un fondateur actif peut gérer cette organisation.");
    const membership = await transaction.organizationMembership.findFirst({ where: { id: membershipId, organizationId, role: "TECHNICAL_ADMIN" }, select: { id: true, status: true, userId: true } });
    if (!membership || membership.status === "PENDING" || membership.status === status) throw new OrganizationGovernanceError("Cette appartenance technique ne peut pas être modifiée.");
    const updated = await transaction.organizationMembership.update({ where: { id: membership.id }, data: { status }, select: { id: true, status: true, role: true, userId: true } });
    await appendAuditEvent(transaction, { organizationId, actorUserId, action: status === "SUSPENDED" ? "ORGANIZATION_TECHNICAL_ADMIN_SUSPENDED" : "ORGANIZATION_TECHNICAL_ADMIN_REACTIVATED", entityType: "OrganizationMembership", entityId: membership.id, before: { status: membership.status }, after: { status: updated.status, role: updated.role, userId: updated.userId } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignTechnicalAdmin(actorUserId: string, input: z.input<typeof governanceInput>) {
  const parsed = governanceInput.safeParse(input);
  if (!parsed.success) throw new OrganizationGovernanceError("L’adresse e-mail est invalide.");
  return prisma.$transaction(async (transaction) => {
    const founder = await transaction.organizationMembership.findFirst({ where: { userId: actorUserId, organizationId: parsed.data.organizationId, role: "FOUNDER", status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { organizationId: true } });
    if (!founder) throw new OrganizationGovernanceError("Seul un fondateur actif peut gérer cette organisation.");
    const user = await transaction.user.findUnique({ where: { emailNormalized: parsed.data.userEmail.toLowerCase() }, select: { id: true, name: true, status: true } });
    if (!user || !canManageOrganizationMembership({ actorIsFounder: true, organizationActive: true, targetUserActive: user.status === "ACTIVE" })) throw new OrganizationGovernanceError("Le compte actif est introuvable.");
    const existing = await transaction.organizationMembership.findUnique({ where: { userId_organizationId_role: { userId: user.id, organizationId: parsed.data.organizationId, role: "TECHNICAL_ADMIN" } }, select: { id: true, status: true } });
    const membership = existing
      ? await transaction.organizationMembership.update({ where: { id: existing.id }, data: { status: "ACTIVE" }, select: { id: true, role: true, status: true } })
      : await transaction.organizationMembership.create({ data: { userId: user.id, organizationId: parsed.data.organizationId, role: "TECHNICAL_ADMIN", status: "ACTIVE" }, select: { id: true, role: true, status: true } });
    await appendAuditEvent(transaction, { organizationId: parsed.data.organizationId, actorUserId, action: "ORGANIZATION_TECHNICAL_ADMIN_ASSIGNED", entityType: "OrganizationMembership", entityId: membership.id, after: { userId: user.id, role: membership.role, status: membership.status } });
    return { ...membership, user };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
