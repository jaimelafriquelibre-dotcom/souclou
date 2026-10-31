import { describe, expect, it } from "vitest";
import {
  CREDENTIAL_ATTEMPT_LIMIT,
  createCredentialAttemptKey,
  isCredentialAttemptAllowed,
} from "./credential-rate-limit";

describe("credential rate limit", () => {
  it("creates stable HMAC keys without storing the username", () => {
    const first = createCredentialAttemptKey(" Fondateur ", "test-secret");
    const normalized = createCredentialAttemptKey("fondateur", "test-secret");

    expect(first).toBe(normalized);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("fondateur");
    expect(createCredentialAttemptKey("fondateur", "other-secret")).not.toBe(
      first,
    );
  });

  it("allows at most the configured number of attempts", () => {
    expect(isCredentialAttemptAllowed(CREDENTIAL_ATTEMPT_LIMIT)).toBe(true);
    expect(isCredentialAttemptAllowed(CREDENTIAL_ATTEMPT_LIMIT + 1)).toBe(false);
    expect(isCredentialAttemptAllowed(Number.NaN)).toBe(false);
  });
});
