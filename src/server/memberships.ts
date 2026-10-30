import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { createInAppNotifications } from "@/server/notifications";
import {
  canUserPerformInSchoolUsing,
  getInvitableSchoolRolesUsing,
} from "@/server/permissions";

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
