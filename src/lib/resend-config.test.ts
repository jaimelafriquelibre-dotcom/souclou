import { describe, expect, it } from "vitest";
import { isResendConfigured } from "./resend-config";

describe("isResendConfigured", () => {
  it("requires both non-empty Resend settings", () => {
    expect(isResendConfigured({})).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "key" })).toBe(false);
    expect(isResendConfigured({ RESEND_FROM: "noreply@example.test" })).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "  ", RESEND_FROM: "sender" })).toBe(false);
  });

  it("accepts a complete configuration", () => {
    expect(
      isResendConfigured({
        RESEND_API_KEY: "re_test_key",
        RESEND_FROM: "SOUCLOU <noreply@example.test>",
      }),
    ).toBe(true);
  });
});
