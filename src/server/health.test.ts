import { describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth } from "./health";

describe("checkDatabaseHealth", () => {
  it("confirme une base disponible", async () => {
    const reader = { $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]) };
    await expect(checkDatabaseHealth(reader)).resolves.toEqual({ status: "ok" });
  });

  it("masque les détails quand la base est indisponible", async () => {
    const reader = { $queryRaw: vi.fn().mockRejectedValue(new Error("secret interne")) };
    await expect(checkDatabaseHealth(reader)).resolves.toEqual({ status: "unavailable" });
  });
});
