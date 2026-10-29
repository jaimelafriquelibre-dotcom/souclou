import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
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
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class MembershipServiceError extends Error {
  constructor(
    readonly code: MembershipServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MembershipServiceError";
  }
}

const inviteSchema = z.object({
  schoolId: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
  role: z.enum([
    "STUDIES_DIRECTOR",
    "EDUCATOR",
    "ADMINISTRATIVE_STAFF",
    "TEACHER",
    "STUDENT",
    "GUARDIAN",
  ]),
});

async function inviteWithClient(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
  input: z.infer<typeof inviteSchema>,
) {
  const school = await transaction.school.findUnique({
    where: { id: input.schoolId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      organization: { select: { status: true } },
    },
  });

  if (
    !school ||
    school.status !== "ACTIVE" ||
    school.organization.status !== "ACTIVE"
  ) {
    throw new MembershipServiceError(
      "NOT_FOUND",
      "Établissement actif introuvable.",
    );
  }

  if (
    !(await getInvitableSchoolRolesUsing(
      transaction,
      actorUserId,
      school.id,
    )).includes(input.role)
  ) {
    throw new MembershipServiceError(
      "FORBIDDEN",
      "Vous n’êtes pas autorisé à gérer les comptes de cet établissement.",
    );
  }

  const existingUser = await transaction.user.findUnique({
    where: { emailNormalized: input.email },
    select: {
      id: true,
      status: true,
    },
  });

  if (existingUser?.status === "SUSPENDED") {
    throw new MembershipServiceError(
      "INVALID_STATE",
      "Un compte suspendu ne peut pas être invité.",
    );
  }

  const user =
    existingUser ??
    (await transaction.user.create({
      data: {
        email: input.email,
        emailNormalized: input.email,
        name: input.name,
        status: "PENDING",
      },
      select: { id: true },
    }));

  const existingMembership = await transaction.schoolMembership.findUnique({
    where: {
      userId_schoolId_role: {
        userId: user.id,
        schoolId: school.id,
        role: input.role,
      },
    },
    select: { id: true },
  });

  if (existingMembership) {
    throw new MembershipServiceError(
      "ALREADY_EXISTS",
      "Ce compte possède déjà cette appartenance à l’établissement.",
    );
  }

  const membership = await transaction.schoolMembership.create({
    data: {
      userId: user.id,
      schoolId: school.id,
      role: input.role,
      status: "PENDING",
    },
    select: { id: true, role: true, status: true },
  });

  await appendAuditEvent(transaction, {
    organizationId: school.organizationId,
    schoolId: school.id,
    actorUserId,
    action: "MEMBERSHIP_INVITED",
    entityType: "SchoolMembership",
    entityId: membership.id,
    after: {
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
    },
  });

  return membership;
}

export async function inviteSchoolMember(
  actorUserId: string,
  input: z.input<typeof inviteSchema>,
) {
  const parsed = inviteSchema.safeParse(input);

  if (!parsed.success) {
    throw new MembershipServiceError(
      "INVALID_INPUT",
      "Vérifiez l’adresse e-mail, le nom et l’établissement.",
    );
  }

  return prisma.$transaction(
    (transaction) =>
      inviteWithClient(transaction, actorUserId, {
        ...parsed.data,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
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
