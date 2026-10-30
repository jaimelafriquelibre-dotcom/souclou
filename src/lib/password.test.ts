import { describe, expect, it } from "vitest";
import { hashPassword, normalizeUsername, verifyPassword } from "./password";

describe("password helpers", () => {
  it("normalizes usernames and verifies hashed passwords", async () => {
    const username = "  Admin  ";

    expect(normalizeUsername(username)).toBe("admin");

    const hash = await hashPassword("Secret123!");
    expect(hash).not.toBe("Secret123!");

    await expect(verifyPassword("Secret123!", hash)).resolves.toBe(true);
    await expect(verifyPassword("WrongSecret123!", hash)).resolves.toBe(false);
  });
});
