import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { createInAppNotifications } from "@/server/notifications";
import {
  canUserPerformInSchoolUsing,
  getInvitableSchoolRolesUsing,
} from "@/server/permissions";
import { canTransitionMembership } from "@/lib/membership-rules";

export type MembershipServiceErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE";

export class MembershipServiceError extends Error {
  constructor(
    readonly code: MembershipServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MembershipServiceError";
  }
}

export async function approveSchoolMember(
  actorUserId: string,
  schoolId: string,
  membershipId: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const membership = await transaction.schoolMembership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          schoolId: true,
          role: true,
          status: true,
          userId: true,
          user: { select: { status: true } },
          school: {
            select: {
              organizationId: true,
              status: true,
              organization: { select: { status: true } },
            },
          },
        },
      });

      if (!membership || membership.schoolId !== schoolId) {
        throw new MembershipServiceError(
          "NOT_FOUND",
          "Demande d’accès introuvable.",
        );
      }

      if (
        membership.school.status !== "ACTIVE" ||
        membership.school.organization.status !== "ACTIVE"
      ) {
        throw new MembershipServiceError(
          "INVALID_STATE",
          "Les demandes d’accès sont suspendues pour cet établissement.",
        );
      }

      if (
        membership.status !== "PENDING" ||
        membership.user.status === "SUSPENDED"
      ) {
        throw new MembershipServiceError(
          "INVALID_STATE",
          "Cette demande ne peut plus être approuvée.",
        );
      }

      if (membership.userId === actorUserId) {
        throw new MembershipServiceError(
          "FORBIDDEN",
          "Vous ne pouvez pas approuver votre propre compte.",
        );
      }

      if (
        !(await canUserPerformInSchoolUsing(
          transaction,
          actorUserId,
          membership.schoolId,
          "approve_accounts",
        ))
      ) {
        throw new MembershipServiceError(
          "FORBIDDEN",
          "Vous n’êtes pas autorisé à approuver les comptes de cet établissement.",
        );
      }

      if (
        !(await getInvitableSchoolRolesUsing(
          transaction,
          actorUserId,
          membership.schoolId,
        )).includes(membership.role)
      ) {
        throw new MembershipServiceError(
          "FORBIDDEN",
          "Vous n’êtes pas autorisé à approuver ce rôle.",
        );
      }

      const updatedMembership = await transaction.schoolMembership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
        select: { id: true, role: true, status: true },
      });

      if (membership.user.status === "PENDING") {
        await transaction.user.update({
          where: { id: membership.userId },
          data: { status: "ACTIVE" },
        });
      }

      await appendAuditEvent(transaction, {
        organizationId: membership.school.organizationId,
        schoolId: membership.schoolId,
        actorUserId,
        action: "MEMBERSHIP_APPROVED",
        entityType: "SchoolMembership",
        entityId: membership.id,
        before: { status: membership.status },
        after: {
          membershipId: updatedMembership.id,
          role: updatedMembership.role,
          status: updatedMembership.status,
        },
      });
      await createInAppNotifications(transaction, {
        schoolId: membership.schoolId,
        userIds: [membership.userId],
        type: "ACCOUNT_APPROVED",
        title: "Compte approuvé",
        body: "Votre accès à l’établissement est maintenant actif.",
        href: "/portail",
      });

      return updatedMembership;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setSchoolMemberStatus(
  actorUserId: string,
  schoolId: string,
  membershipId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.schoolMembership.findUnique({
      where: { id: membershipId },
      select: {
        id: true, schoolId: true, userId: true, role: true, status: true,
        school: { select: { organizationId: true, status: true, organization: { select: { status: true } } } },
      },
    });
    if (!membership || membership.schoolId !== schoolId) {
      throw new MembershipServiceError("NOT_FOUND", "Appartenance introuvable.");
    }
    if (membership.userId === actorUserId) {
      throw new MembershipServiceError("FORBIDDEN", "Vous ne pouvez pas modifier votre propre appartenance.");
    }
    if (membership.school.status !== "ACTIVE" || membership.school.organization.status !== "ACTIVE") {
      throw new MembershipServiceError("INVALID_STATE", "Les appartenances sont verrouillées pour cet établissement.");
    }
    if (!canTransitionMembership(membership.status, status)) {
      throw new MembershipServiceError("INVALID_STATE", "Cette transition d’appartenance n’est pas autorisée.");
    }
    if (!(await canUserPerformInSchoolUsing(transaction, actorUserId, schoolId, "approve_accounts"))) {
      throw new MembershipServiceError("FORBIDDEN", "Vous n’êtes pas autorisé à gérer ces appartenances.");
    }
    const updated = await transaction.schoolMembership.update({
      where: { id: membership.id }, data: { status }, select: { id: true, status: true, role: true },
    });
    await appendAuditEvent(transaction, {
      organizationId: membership.school.organizationId, schoolId, actorUserId,
      action: status === "SUSPENDED" ? "MEMBERSHIP_SUSPENDED" : "MEMBERSHIP_REACTIVATED",
      entityType: "SchoolMembership", entityId: membership.id,
      before: { status: membership.status }, after: { status: updated.status, role: updated.role },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
