import { describe, expect, it } from "vitest";
import { normalizeSchoolSettings } from "./school-settings-validation";

describe("normalizeSchoolSettings", () => {
  it("normalise le code et accepte le fuseau ivoirien", () => {
    expect(normalizeSchoolSettings({
      schoolId: "school-1",
      name: "École fictive",
      code: "ecole-01",
      timeZone: "Africa/Abidjan",
    })).toMatchObject({ code: "ECOLE-01", timeZone: "Africa/Abidjan" });
  });

  it("refuse un fuseau horaire inconnu", () => {
    expect(() => normalizeSchoolSettings({
      schoolId: "school-1",
      name: "École fictive",
      code: "ECOLE-01",
      timeZone: "Africa/NotARealCity",
    })).toThrow();
  });
});
