import { describe, expect, it } from "vitest";
import { containsSensitiveAuditKey } from "./audit-safety";

describe("containsSensitiveAuditKey", () => {
  it("detects sensitive fields at any nesting level", () => {
    expect(containsSensitiveAuditKey({ status: "ACTIVE" })).toBe(false);
    expect(containsSensitiveAuditKey({ after: { student: { givenNames: "Test" } } })).toBe(true);
    expect(containsSensitiveAuditKey([{ email: "test@example.test" }])).toBe(true);
  });
});
