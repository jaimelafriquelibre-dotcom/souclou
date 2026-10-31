import { checkDatabaseHealth } from "@/server/health";

export async function GET() {
  try {
    const { prisma } = await import("@/server/db");
    const health = await checkDatabaseHealth(prisma);
    return Response.json(
      { ...health, service: "souclou" },
      { status: health.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "souclou" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
