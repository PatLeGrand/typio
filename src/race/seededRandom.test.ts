import { describe, expect, it } from "vitest";
import { createSeededRandom, shuffled } from "./seededRandom";

describe("createSeededRandom", () => {
  it("rend la même suite pour la même graine, dans [0, 1[", () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const values = Array.from({ length: 50 }, () => a());
    expect(values).toEqual(Array.from({ length: 50 }, () => b()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(createSeededRandom(43)()).not.toBe(values[0]);
  });
});

describe("shuffled", () => {
  it("garde les mêmes éléments, sans modifier la liste d'origine, et dépend de la graine", () => {
    const names = ["a", "b", "c", "d", "e", "f", "g"];
    const first = shuffled(names, createSeededRandom(1));
    expect([...first].sort()).toEqual(names);
    expect(names).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(shuffled(names, createSeededRandom(1))).toEqual(first);
    const orders = new Set(Array.from({ length: 20 }, (_, seed) => shuffled(names, createSeededRandom(seed)).join("")));
    expect(orders.size).toBeGreaterThan(5);
  });
});
