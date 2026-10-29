"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { notificationAccessScope } from "@/server/notification-scope";
import { requireActiveUserId } from "@/server/session";

export async function markNotificationReadAction(formData: FormData) {
  const parsed = z
    .object({ notificationId: z.string().min(1) })
    .safeParse({ notificationId: formData.get("notificationId") });
  if (!parsed.success) {
    throw new Error("Notification invalide.");
  }

  const userId = await requireActiveUserId();
  const notification = await prisma.notification.findFirst({
    where: {
      id: parsed.data.notificationId,
      ...notificationAccessScope(userId),
    },
    select: { id: true },
  });
  if (!notification) {
    throw new Error("Notification introuvable.");
  }

  await prisma.notification.updateMany({
    where: {
      id: notification.id,
      ...notificationAccessScope(userId),
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/portail/notifications");
  revalidatePath("/portail");
}

export async function markAllNotificationsReadAction() {
  const userId = await requireActiveUserId();
  await prisma.notification.updateMany({
    where: {
      ...notificationAccessScope(userId),
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/portail/notifications");
  revalidatePath("/portail");
}
