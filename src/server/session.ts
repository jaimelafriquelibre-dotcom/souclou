import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "../../auth";

export async function requireActiveUserId() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/connexion");
  }

  if (session.user.status !== "ACTIVE") {
    redirect("/en-attente");
  }

  return session.user.id;
}
