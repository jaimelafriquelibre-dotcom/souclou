import { describe, expect, it } from "vitest";
import { parseAuditAction } from "./audit-filter";

describe("parseAuditAction", () => {
  it("normalizes empty values", () => {
    expect(parseAuditAction(undefined)).toBeUndefined();
    expect(parseAuditAction("   ")).toBeUndefined();
  });

  it("trims and bounds the action", () => {
    expect(parseAuditAction("  school_created  ")).toBe("SCHOOL_CREATED");
    expect(parseAuditAction("x".repeat(150))).toHaveLength(100);
  });
});
