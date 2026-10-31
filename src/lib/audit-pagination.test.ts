import { describe, expect, it } from "vitest";
import { parseAuditPage } from "./audit-pagination";

describe("parseAuditPage", () => {
  it("normalizes invalid and out-of-range values", () => {
    expect(parseAuditPage(undefined)).toBe(1);
    expect(parseAuditPage("abc")).toBe(1);
    expect(parseAuditPage("0")).toBe(1);
    expect(parseAuditPage("-5")).toBe(1);
    expect(parseAuditPage("2000")).toBe(1000);
  });

  it("keeps a valid page", () => {
    expect(parseAuditPage("12")).toBe(12);
  });
});
