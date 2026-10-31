import { describe, expect, it } from "vitest";
import { placeMissedKeys } from "./keyboard";

describe("placeMissedKeys", () => {
  it("regroupe majuscules et caractères décalés sur leur touche physique", () => {
    const placed = placeMissedKeys({ A: 2, a: 1, é: 3, É: 1, "2": 2, " ": 1 }, "fr");
    expect(placed.rows.flat().find((key) => key.key === "a")?.count).toBe(3);
    expect(placed.rows.flat().find((key) => key.key === "é")?.count).toBe(6);
    expect(placed.rows.flat().find((key) => key.key === " ")?.count).toBe(1);
    expect(placed.max).toBe(6);
    expect(placed.other).toEqual([]);
  });
  it.each(["fr", "en"] as const)("regroupe la casse hors disposition en %s", (locale) => {
    const placed = placeMissedKeys({ Ê: 2, ê: 3 }, locale);
    expect(placed.other).toEqual([{ key: "ê", count: 5 }]);
    expect(placed.mostMissed).toEqual([{ key: "ê", count: 5 }]);
    expect(placed.max).toBe(5);
  });
  it("sépare les caractères absents de la disposition choisie", () => {
    const placed = placeMissedKeys({ A: 1, é: 2, ô: 3, "!": 4 }, "en");
    expect(placed.other).toEqual([{ key: "é", count: 2 }, { key: "ô", count: 3 }]);
    expect(placed.rows.flat().find((key) => key.key === "1")?.count).toBe(4);
    expect(placed.mostMissed[0].key).toBe("1");
  });
});
