import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export type AuditEvent = {
  organizationId: string;
  schoolId?: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  reason?: string;
};

export function appendAuditEvent(
  transaction: Prisma.TransactionClient,
  event: AuditEvent,
) {
  return transaction.auditLog.create({
    data: {
      organizationId: event.organizationId,
      schoolId: event.schoolId,
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: event.before,
      after: event.after,
      reason: event.reason,
    },
  });
}
