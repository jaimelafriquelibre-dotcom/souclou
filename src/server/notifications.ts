import "server-only";

import type { NotificationType, Prisma } from "@/generated/prisma/client";

type CreateNotificationInput = {
  schoolId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  href: string;
};

export async function createInAppNotifications(
  transaction: Prisma.TransactionClient,
  input: CreateNotificationInput,
) {
  const userIds = [...new Set(input.userIds)];
  if (userIds.length === 0) {
    return 0;
  }

  const result = await transaction.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      schoolId: input.schoolId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    })),
  });
  return result.count;
}
