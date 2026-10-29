import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { appendAuditEvent } from "@/server/audit";
import { prisma } from "@/server/db";
import { createInAppNotifications } from "@/server/notifications";
import { canUserPerformInSchoolUsing } from "@/server/permissions";

export type PublicationErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class PublicationError extends Error {
  constructor(
    readonly code: PublicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublicationError";
  }
}

const publicationTypes = [
  "NOTICE",
  "EVENT",
  "OFFICIAL_INFORMATION",
] as const;
const approverRoleSchema = z.enum([
  "STUDIES_DIRECTOR",
  "EDUCATOR",
  "ADMINISTRATIVE_STAFF",
]);

const policySchema = z.object({
  schoolId: z.string().min(1),
  type: z.enum(publicationTypes),
  requiredApprovals: z.number().int().min(1).max(3),
  approverRoles: z.array(approverRoleSchema).min(1).max(3),
});

const publicationSchema = z.object({
  schoolId: z.string().min(1),
  type: z.enum(publicationTypes),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(10000),
});

async function requireActiveSchool(
  transaction: Prisma.TransactionClient,
  schoolId: string,
) {
  const school = await transaction.school.findUnique({
    where: { id: schoolId },
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
    throw new PublicationError("NOT_FOUND", "Établissement actif introuvable.");
  }
  return school;
}

export async function savePublicationPolicy(
  actorUserId: string,
  input: z.input<typeof policySchema>,
) {
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicationError(
      "INVALID_INPUT",
      "Choisissez une catégorie, un quorum et les rôles autorisés.",
    );
  }

  const { schoolId, type, requiredApprovals, approverRoles } = parsed.data;
  const roles = [...new Set(approverRoles)];
  if (requiredApprovals > roles.length) {
    throw new PublicationError(
      "INVALID_INPUT",
      "Le nombre de validations ne peut pas dépasser les rôles sélectionnés.",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const school = await requireActiveSchool(transaction, schoolId);
      if (
        !(await canUserPerformInSchoolUsing(
          transaction,
          actorUserId,
          schoolId,
          "manage_publication_policies",
        ))
      ) {
        throw new PublicationError(
          "FORBIDDEN",
          "Vous ne pouvez pas configurer les validations de cet établissement.",
        );
      }

      const eligibleUsers = await transaction.schoolMembership.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
          role: { in: roles },
          user: { status: "ACTIVE" },
        },
        distinct: ["userId"],
        select: { userId: true },
      });
      if (
        eligibleUsers.filter((membership) => membership.userId !== actorUserId)
          .length < requiredApprovals
      ) {
        throw new PublicationError(
          "INVALID_STATE",
          "Le nombre de responsables distincts disponibles est insuffisant pour ce quorum.",
        );
      }

      const previous = await transaction.publicationPolicy.findUnique({
        where: { schoolId_type: { schoolId, type } },
        select: {
          id: true,
          requiredApprovals: true,
          approverRoles: true,
        },
      });
      if (
        previous &&
        (await transaction.publication.count({
          where: { policyId: previous.id, status: "PENDING" },
        })) > 0
      ) {
        throw new PublicationError(
          "INVALID_STATE",
          "La règle ne peut pas être modifiée tant que des publications attendent une décision.",
        );
      }

      const policy = await transaction.publicationPolicy.upsert({
        where: { schoolId_type: { schoolId, type } },
        create: {
          schoolId,
          type,
          requiredApprovals,
          approverRoles: roles,
        },
        update: {
          requiredApprovals,
          approverRoles: roles,
        },
        select: { id: true, type: true, requiredApprovals: true },
      });

      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: previous
          ? "PUBLICATION_POLICY_UPDATED"
          : "PUBLICATION_POLICY_CREATED",
        entityType: "PublicationPolicy",
        entityId: policy.id,
        before: previous
          ? {
              requiredApprovals: previous.requiredApprovals,
              approverRoles: previous.approverRoles,
            }
          : undefined,
        after: {
          type: policy.type,
          requiredApprovals: policy.requiredApprovals,
          approverRoles: roles,
        },
      });

      return policy;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function submitPublication(
  actorUserId: string,
  input: z.input<typeof publicationSchema>,
) {
  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success) {
    throw new PublicationError(
      "INVALID_INPUT",
      "Vérifiez la catégorie, le titre et le contenu.",
    );
  }

  const { schoolId, type, title, body } = parsed.data;
  return prisma.$transaction(
    async (transaction) => {
      const school = await requireActiveSchool(transaction, schoolId);
      if (
        !(await canUserPerformInSchoolUsing(
          transaction,
          actorUserId,
          schoolId,
          "create_publication",
        ))
      ) {
        throw new PublicationError(
          "FORBIDDEN",
          "Vous ne pouvez pas soumettre une publication dans cet établissement.",
        );
      }

      const policy = await transaction.publicationPolicy.findUnique({
        where: { schoolId_type: { schoolId, type } },
        select: {
          id: true,
          requiredApprovals: true,
          approverRoles: true,
        },
      });
      if (!policy) {
        throw new PublicationError(
          "INVALID_STATE",
          "La règle de validation de cette catégorie n’est pas encore configurée.",
        );
      }

      const eligibleUsers = await transaction.schoolMembership.findMany({
        where: {
          schoolId,
          status: "ACTIVE",
          role: { in: policy.approverRoles },
          user: { status: "ACTIVE" },
        },
        distinct: ["userId"],
        select: { userId: true },
      });
      if (
        eligibleUsers.filter((membership) => membership.userId !== actorUserId)
          .length < policy.requiredApprovals
      ) {
        throw new PublicationError(
          "INVALID_STATE",
          "Il n’y a pas assez de responsables distincts pour appliquer cette règle.",
        );
      }

      const publication = await transaction.publication.create({
        data: {
          schoolId,
          policyId: policy.id,
          authorUserId: actorUserId,
          type,
          title,
          body,
          status: "PENDING",
        },
        select: { id: true, type: true, status: true },
      });
      await createInAppNotifications(transaction, {
        schoolId,
        userIds: eligibleUsers
          .map(({ userId }) => userId)
          .filter((userId) => userId !== actorUserId),
        type: "PUBLICATION_APPROVAL_REQUIRED",
        title: "Publication à valider",
        body: `Une publication « ${title} » attend votre décision.`,
        href: `/portail/etablissements/${schoolId}/publications`,
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: "PUBLICATION_SUBMITTED",
        entityType: "Publication",
        entityId: publication.id,
        after: { type, status: publication.status },
      });

      return publication;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function decidePublication(
  actorUserId: string,
  schoolId: string,
  publicationId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
) {
  const parsedComment = z.string().trim().max(500).optional().safeParse(comment);
  if (!parsedComment.success) {
    throw new PublicationError(
      "INVALID_INPUT",
      "Le commentaire est limité à 500 caractères.",
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const school = await requireActiveSchool(transaction, schoolId);
      const publication = await transaction.publication.findFirst({
        where: { id: publicationId, schoolId },
        select: {
          id: true,
          authorUserId: true,
          title: true,
          status: true,
          policy: {
            select: { requiredApprovals: true, approverRoles: true },
          },
        },
      });
      if (!publication) {
        throw new PublicationError("NOT_FOUND", "Publication introuvable.");
      }
      if (publication.status !== "PENDING") {
        throw new PublicationError(
          "INVALID_STATE",
          "Cette publication a déjà été traitée.",
        );
      }
      if (publication.authorUserId === actorUserId) {
        throw new PublicationError(
          "FORBIDDEN",
          "L’auteur ne peut pas valider sa propre publication.",
        );
      }

      const approverMembership =
        await transaction.schoolMembership.findFirst({
          where: {
            userId: actorUserId,
            schoolId,
            status: "ACTIVE",
            role: { in: publication.policy.approverRoles },
            user: { status: "ACTIVE" },
          },
          select: { id: true },
        });
      if (!approverMembership) {
        throw new PublicationError(
          "FORBIDDEN",
          "Votre rôle ne fait pas partie des approbateurs autorisés.",
        );
      }

      const existing = await transaction.publicationApproval.findUnique({
        where: {
          publicationId_approverUserId: { publicationId, approverUserId: actorUserId },
        },
        select: { id: true },
      });
      if (existing) {
        throw new PublicationError(
          "ALREADY_EXISTS",
          "Vous avez déjà donné votre décision pour cette publication.",
        );
      }

      await transaction.publicationApproval.create({
        data: {
          publicationId,
          approverUserId: actorUserId,
          decision,
          comment: parsedComment.data || null,
        },
      });

      let nextStatus: "PENDING" | "PUBLISHED" | "REJECTED" = "PENDING";
      if (decision === "REJECTED") {
        nextStatus = "REJECTED";
      } else {
        const approvalCount = await transaction.publicationApproval.count({
          where: { publicationId, decision: "APPROVED" },
        });
        if (approvalCount >= publication.policy.requiredApprovals) {
          nextStatus = "PUBLISHED";
        }
      }

      const updated = await transaction.publication.update({
        where: { id: publication.id },
        data: {
          status: nextStatus,
          ...(nextStatus === "PUBLISHED" ? { publishedAt: new Date() } : {}),
        },
        select: { id: true, status: true },
      });
      await appendAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action:
          decision === "APPROVED"
            ? "PUBLICATION_APPROVED"
            : "PUBLICATION_REJECTED",
        entityType: "Publication",
        entityId: publication.id,
        before: { status: publication.status },
        after: { status: updated.status, decision },
      });

      await createInAppNotifications(transaction, {
        schoolId,
        userIds: [publication.authorUserId],
        type: "PUBLICATION_DECISION",
        title:
          updated.status === "PUBLISHED"
            ? "Publication approuvée"
            : decision === "REJECTED"
              ? "Publication rejetée"
              : "Approbation enregistrée",
        body:
          updated.status === "PUBLISHED"
            ? "Votre publication est maintenant visible dans l’espace famille."
            : decision === "REJECTED"
              ? "Votre publication a été rejetée."
              : "Une approbation supplémentaire a été donnée.",
        href: `/portail/etablissements/${schoolId}/publications`,
      });

      if (updated.status === "PUBLISHED") {
        const guardianLinks = await transaction.guardianStudentLink.findMany({
          where: {
            schoolId,
            status: "ACTIVE",
            guardian: { status: "ACTIVE" },
            student: {
              status: "ACTIVE",
              enrollments: {
                some: {
                  status: "ACTIVE",
                  academicYear: { status: "ACTIVE" },
                },
              },
            },
          },
          distinct: ["guardianUserId"],
          select: { guardianUserId: true },
        });
        await createInAppNotifications(transaction, {
          schoolId,
          userIds: guardianLinks.map(({ guardianUserId }) => guardianUserId),
          type: "PUBLICATION_PUBLISHED",
          title: "Nouvelle information de l’établissement",
          body: `Une publication « ${publication.title} » est disponible.`,
          href: `/portail/etablissements/${schoolId}/publications`,
        });
      }

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
