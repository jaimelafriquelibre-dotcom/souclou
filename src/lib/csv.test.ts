import { describe, expect, it } from "vitest";
import { toCsvCell, toCsvRow } from "./csv";

describe("CSV serialization", () => {
  it("quotes and escapes delimiters and quotes", () => {
    expect(toCsvCell('Nom; "Prénom"')).toBe('"Nom; ""Prénom"""');
  });

  it("neutralizes spreadsheet formulas", () => {
    for (const value of [
      "=1+1",
      "+SUM(A1:A2)",
      "-1+2",
      "@SUM(A1)",
      "\t=1+1",
      " =1+1",
    ]) {
      expect(toCsvCell(value)).toBe(`"'${value}"`);
    }
  });

  it("serializes rows with the French spreadsheet delimiter", () => {
    expect(toCsvRow(["Nom", "A; B"])).toBe('"Nom";"A; B"');
  });
});
