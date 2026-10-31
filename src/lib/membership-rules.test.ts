import { describe, expect, it } from "vitest";
import { canTransitionMembership } from "./membership-rules";

describe("canTransitionMembership", () => {
  it("autorise la suspension et la réactivation", () => {
    expect(canTransitionMembership("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionMembership("SUSPENDED", "ACTIVE")).toBe(true);
  });
  it("refuse les demandes en attente et les transitions identiques", () => {
    expect(canTransitionMembership("PENDING", "ACTIVE")).toBe(false);
    expect(canTransitionMembership("ACTIVE", "ACTIVE")).toBe(false);
  });
});
