import { describe, expect, it } from "vitest";
import { canTransitionAcademicYear } from "./academic-year-rules";

describe("canTransitionAcademicYear", () => {
  it("autorise uniquement l’ouverture puis la clôture", () => {
    expect(canTransitionAcademicYear("PLANNED", "ACTIVE")).toBe(true);
    expect(canTransitionAcademicYear("ACTIVE", "CLOSED")).toBe(true);
  });

  it("refuse les réouvertures et clôtures incohérentes", () => {
    expect(canTransitionAcademicYear("CLOSED", "ACTIVE")).toBe(false);
    expect(canTransitionAcademicYear("PLANNED", "CLOSED")).toBe(false);
    expect(canTransitionAcademicYear("ACTIVE", "ACTIVE")).toBe(false);
  });
});
