import { Suspense } from "react";
import Link from "next/link";
import { PortalPageHeader } from "@/app/portail/page-header";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";
import { prisma } from "@/server/db";
import { notificationAccessScope } from "@/server/notification-scope";
import { requireActiveUserId } from "@/server/session";

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <main
          aria-busy="true"
          className="min-h-screen bg-slate-50 px-6 py-12 text-slate-600"
          role="status"
        >
          Chargement des notifications…
        </main>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const userId = await requireActiveUserId();
  const notificationScope = notificationAccessScope(userId);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: notificationScope,
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { ...notificationScope, readAt: null },
    }),
  ]);

  return (
    <main className="notifications-page min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <PortalPageHeader
          description="Retrouvez les informations récentes des établissements auxquels vous avez accès."
          eyebrow="SOUCLOU · Portail"
          title="Notifications"
        />
        {unreadCount > 0 ? (
          <div className="notifications-toolbar">
            <span className="notifications-unread-count">
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </span>
            <form action={markAllNotificationsReadAction}>
              <button className="notifications-read-all" type="submit">
                Tout marquer comme lu
              </button>
            </form>
          </div>
        ) : null}
        {notifications.length === 0 ? (
          <p className="notifications-empty">
            Vous n’avez aucune notification.
          </p>
        ) : (
          <ul className="notifications-list divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {notifications.map((notification) => {
              const href =
                notification.href.startsWith("/") &&
                !notification.href.startsWith("//")
                  ? notification.href
                  : "/portail";

              return (
                <li
                  className={`flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between ${
                    notification.readAt ? "" : "border-l-4 border-teal-700 pl-3"
                  }`}
                  key={notification.id}
                >
                  <div>
                    <Link
                      className="font-semibold text-teal-900 underline-offset-4 hover:underline"
                      href={href}
                    >
                      {notification.title}
                    </Link>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {notification.body}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Intl.DateTimeFormat("fr-CI", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Abidjan",
                      }).format(notification.createdAt)}
                    </p>
                  </div>
                  {notification.readAt ? (
                    <span className="text-xs text-slate-500">Lue</span>
                  ) : (
                    <form action={markNotificationReadAction}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <button
                        className="text-sm font-semibold text-teal-800 underline underline-offset-4"
                        type="submit"
                      >
                        Marquer comme lue
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
