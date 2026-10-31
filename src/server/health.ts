type HealthReader = { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> };

export async function checkDatabaseHealth(reader: HealthReader) {
  try {
    await reader.$queryRaw`SELECT 1`;
    return { status: "ok" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}
