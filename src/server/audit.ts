import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { containsSensitiveAuditKey } from "@/lib/audit-safety";

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
  if (containsSensitiveAuditKey(event.before) || containsSensitiveAuditKey(event.after)) {
    throw new Error("AUDIT_PAYLOAD_CONTAINS_SENSITIVE_FIELD");
  }

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
