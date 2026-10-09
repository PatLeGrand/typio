import { describe, expect, it } from "vitest";
import {
  applyTypedInput,
  computeAccuracy,
  computeWpm,
  countCorrectChars,
  NO_KEYSTROKES,
  type Keystrokes,
} from "./metrics";

/** Rejoue une suite de valeurs successives du champ de saisie. */
function type(text: string, inputs: readonly string[], mode: "free" | "blocking" = "free") {
  let typed = "";
  let keystrokes: Keystrokes = NO_KEYSTROKES;
  for (const next of inputs) ({ typed, keystrokes } = applyTypedInput(typed, next, text, mode, keystrokes));
  return { typed, keystrokes };
}

describe("computeWpm (A-D6)", () => {
  it("compte 5 caractères corrects par mot et arrondit à l'entier", () => {
    expect(computeWpm(250, 60_000)).toBe(50);
    expect(computeWpm(100, 30_000)).toBe(40);
    expect(computeWpm(7, 60_000)).toBe(1);
    expect(computeWpm(8, 60_000)).toBe(2);
  });
  it("rend 0 sans durée ni caractère correct", () => {
    expect(computeWpm(50, 0)).toBe(0);
    expect(computeWpm(50, -10)).toBe(0);
    expect(computeWpm(50, Number.NaN)).toBe(0);
    expect(computeWpm(0, 60_000)).toBe(0);
  });
});

describe("computeAccuracy (A-D6)", () => {
  it("vaut 100 % tant qu'aucune frappe n'est faite", () => {
    expect(computeAccuracy(NO_KEYSTROKES)).toBe(100);
  });
  it("arrondit le pourcentage", () => {
    expect(computeAccuracy({ total: 11, correct: 10 })).toBe(91);
    expect(computeAccuracy({ total: 3, correct: 1 })).toBe(33);
    expect(computeAccuracy({ total: 3, correct: 2 })).toBe(67);
  });
});

describe("countCorrectChars", () => {
  it("compte les caractères à la bonne position, fautes comprises", () => {
    expect(countCorrectChars("abXdY", "abcde")).toBe(3);
    expect(countCorrectChars("", "abc")).toBe(0);
    expect(countCorrectChars("abcdef", "abc")).toBe(3);
  });
});

describe("applyTypedInput", () => {
  it("AC-5 : 10 caractères justes et 1 faute corrigée donnent 91 %", () => {
    const text = "0123456789";
    const result = type(text, ["0", "01", "012", "0123", "01234", "012345x", "012345", "0123456", "01234567", "012345678", "0123456789"]);
    expect(result.typed).toBe(text);
    expect(result.keystrokes).toEqual({ total: 11, correct: 10 });
    expect(computeAccuracy(result.keystrokes)).toBe(91);
  });

  it("n'efface rien aux compteurs et ignore Backspace (mode libre)", () => {
    const result = type("abc", ["a", "ax", "a", "", "a"]);
    expect(result.typed).toBe("a");
    expect(result.keystrokes).toEqual({ total: 3, correct: 2 });
  });

  it("mode libre : après une faute, les frappes suivantes sont jugées sur leur position", () => {
    const result = type("abcd", ["a", "ax", "axc", "axcd"]);
    expect(result.typed).toBe("axcd");
    expect(result.keystrokes).toEqual({ total: 4, correct: 3 });
    expect(countCorrectChars(result.typed, "abcd")).toBe(3);
  });

  it("mode bloquant : le caractère faux n'entre pas mais compte comme une frappe fausse", () => {
    const result = type("abc", ["a", "ax", "ab", "abc"], "blocking");
    expect(result.typed).toBe("abc");
    expect(result.keystrokes).toEqual({ total: 4, correct: 3 });
  });

  it("mode bloquant : effacer reste possible", () => {
    const result = type("abc", ["a", "ab", "a"], "blocking");
    expect(result.typed).toBe("a");
    expect(result.keystrokes).toEqual({ total: 2, correct: 2 });
  });

  it("ne dépasse jamais la longueur du texte", () => {
    const result = type("ab", ["a", "ab", "abc"]);
    expect(result.typed).toBe("ab");
    expect(result.keystrokes).toEqual({ total: 2, correct: 2 });
  });
});
