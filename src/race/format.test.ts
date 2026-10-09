import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { formatClock, formatDuration, formatOrdinal, formatPlural } from "./format";

describe("formatOrdinal (A-D9)", () => {
  it("français : 1er puis Ne", () => {
    const { ordinal } = getDictionary("fr").raceScreen;
    expect([1, 2, 3, 4, 11].map((rank) => formatOrdinal("fr", rank, ordinal))).toEqual(["1er", "2e", "3e", "4e", "11e"]);
  });
  it("anglais : st, nd, rd, th et les exceptions 11 à 13", () => {
    const { ordinal } = getDictionary("en").raceScreen;
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map((rank) => formatOrdinal("en", rank, ordinal))).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd",
    ]);
  });
});

describe("formatPlural (UI-5)", () => {
  it("français : 0 et 1 au singulier, le reste au pluriel", () => {
    const { count } = getDictionary("fr").raceSettings.excludedChars;
    expect([0, 1, 2, 5].map((n) => formatPlural("fr", n, count).replace("{count}", String(n)))).toEqual([
      "0 caractère exclu", "1 caractère exclu", "2 caractères exclus", "5 caractères exclus",
    ]);
  });
  it("anglais : 1 au singulier, 0 et le reste au pluriel", () => {
    const { count } = getDictionary("en").raceSettings.excludedChars;
    expect([0, 1, 2].map((n) => formatPlural("en", n, count).replace("{count}", String(n)))).toEqual([
      "0 characters excluded", "1 character excluded", "2 characters excluded",
    ]);
  });
});

describe("formatClock / formatDuration", () => {
  it("tronque ou arrondit au-dessus selon le besoin", () => {
    expect(formatClock(59_999)).toBe("00:59");
    expect(formatClock(59_001, "ceil")).toBe("01:00");
    expect(formatClock(0, "ceil")).toBe("00:00");
    expect(formatClock(-5)).toBe("00:00");
    expect(formatClock(600_000, "ceil")).toBe("10:00");
  });
  it("ajoute le dixième de seconde", () => {
    expect(formatDuration(12_345)).toBe("00:12.3");
    expect(formatDuration(65_000)).toBe("01:05.0");
  });
});
