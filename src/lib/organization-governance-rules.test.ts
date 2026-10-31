import { describe, expect, it } from "vitest";
import { canManageOrganizationMembership } from "./organization-governance-rules";

describe("canManageOrganizationMembership", () => {
  it("autorise uniquement un fondateur sur une organisation et un compte actifs", () => {
    expect(canManageOrganizationMembership({ actorIsFounder: true, organizationActive: true, targetUserActive: true })).toBe(true);
  });
  it("refuse tout périmètre inactif ou rôle insuffisant", () => {
    expect(canManageOrganizationMembership({ actorIsFounder: false, organizationActive: true, targetUserActive: true })).toBe(false);
    expect(canManageOrganizationMembership({ actorIsFounder: true, organizationActive: false, targetUserActive: true })).toBe(false);
    expect(canManageOrganizationMembership({ actorIsFounder: true, organizationActive: true, targetUserActive: false })).toBe(false);
  });
});
