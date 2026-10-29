import type { Prisma } from "@/generated/prisma/client";

export function notificationAccessScope(
  userId: string,
): Prisma.NotificationWhereInput {
  return {
    userId,
    school: {
      status: "ACTIVE",
      organization: { status: "ACTIVE" },
      OR: [
        { memberships: { some: { userId, status: "ACTIVE" } } },
        {
          organization: {
            memberships: { some: { userId, status: "ACTIVE" } },
          },
        },
      ],
    },
  };
}
