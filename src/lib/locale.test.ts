import { describe, expect, it } from "vitest";
import {
  formatIvoirianDate,
  getIvoirianToday,
  IVOIRIAN_CURRENCY,
  IVOIRIAN_LOCALE,
  IVOIRIAN_TIME_ZONE,
} from "./locale";

describe("Ivorian locale defaults", () => {
  it("uses French for Côte d’Ivoire and Abidjan time", () => {
    expect(IVOIRIAN_LOCALE).toBe("fr-CI");
    expect(IVOIRIAN_TIME_ZONE).toBe("Africa/Abidjan");
    expect(IVOIRIAN_CURRENCY).toBe("XOF");
  });

  it("formats a date without shifting the calendar day", () => {
    expect(formatIvoirianDate(new Date("2026-09-01T00:00:00.000Z"))).toContain(
      "1 septembre 2026",
    );
  });

  it("uses the Abidjan calendar day for the attendance date", () => {
    expect(getIvoirianToday(new Date("2026-10-29T23:30:00.000Z"))).toBe(
      "2026-10-29",
    );
  });
});
