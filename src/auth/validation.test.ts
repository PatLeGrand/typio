import { describe, expect, it } from "vitest";
import { validatePassword, validatePseudo, validateUsername } from "./validation";

describe("validateUsername", () => {
  it("normalizes to lowercase and trims, keeping the typed form as display name", () => {
    expect(validateUsername("  Patrick_42 ")).toEqual({
      ok: true,
      value: { username: "patrick_42", displayName: "Patrick_42" },
    });
  });

  it("accepts the 3 and 20 character bounds", () => {
    expect(validateUsername("abc").ok).toBe(true);
    expect(validateUsername("a".repeat(20)).ok).toBe(true);
  });

  it("rejects fewer than 3 and more than 20 characters", () => {
    expect(validateUsername("ab")).toEqual({ ok: false, code: "INVALID_USERNAME" });
    expect(validateUsername("a".repeat(21))).toEqual({ ok: false, code: "INVALID_USERNAME" });
  });

  it("measures the length after trimming", () => {
    expect(validateUsername("  ab  ").ok).toBe(false);
  });

  it("rejects the Kelvin sign U+212A, which lowercases to an ASCII k", () => {
    expect("K".toLowerCase()).toBe("k");
    expect(validateUsername("Kevin")).toEqual({ ok: false, code: "INVALID_USERNAME" });
    expect(validateUsername("marK")).toEqual({ ok: false, code: "INVALID_USERNAME" });
  });

  it("rejects other non-ASCII lookalikes of ASCII letters", () => {
    expect(validateUsername("İstanbul").ok).toBe(false); // İ (I point en chef)
    expect(validateUsername("ａlice").ok).toBe(false); // a pleine chasse
  });

  it.each(["jean-luc", "jean luc", "élodie", "a.b.c", "abc!", "ab\tc", "日本語です"])(
    "rejects %j",
    (value) => {
      expect(validateUsername(value)).toEqual({ ok: false, code: "INVALID_USERNAME" });
    },
  );

  it("rejects non-string values", () => {
    expect(validateUsername(undefined).ok).toBe(false);
    expect(validateUsername(null).ok).toBe(false);
    expect(validateUsername(42).ok).toBe(false);
  });
});

describe("validatePassword", () => {
  it("accepts the 8 and 128 character bounds", () => {
    expect(validatePassword("a".repeat(8)).ok).toBe(true);
    expect(validatePassword("a".repeat(128)).ok).toBe(true);
  });

  it("rejects 7 and 129 characters", () => {
    expect(validatePassword("a".repeat(7))).toEqual({ ok: false, code: "INVALID_PASSWORD" });
    expect(validatePassword("a".repeat(129))).toEqual({ ok: false, code: "INVALID_PASSWORD" });
  });

  it("does not trim or alter the password", () => {
    expect(validatePassword("  secret pass  ")).toEqual({ ok: true, value: "  secret pass  " });
  });

  it("counts characters, not UTF-16 units", () => {
    expect(validatePassword("😀".repeat(8)).ok).toBe(true);
    expect(validatePassword("😀".repeat(7)).ok).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(validatePassword(undefined).ok).toBe(false);
    expect(validatePassword(12345678).ok).toBe(false);
  });
});

describe("validatePseudo", () => {
  it("accepts letters, accents, digits, space, underscore and hyphen", () => {
    expect(validatePseudo("Élodie_2-b c")).toEqual({ ok: true, value: "Élodie_2-b c" });
  });

  it("trims surrounding spaces", () => {
    expect(validatePseudo("  Zoé  ")).toEqual({ ok: true, value: "Zoé" });
  });

  it("normalizes decomposed accents to NFC", () => {
    const decomposed = "Zoé";
    expect(validatePseudo(decomposed)).toEqual({ ok: true, value: "Zoé" });
  });

  it("accepts the 2 and 20 character bounds", () => {
    expect(validatePseudo("ab").ok).toBe(true);
    expect(validatePseudo("a".repeat(20)).ok).toBe(true);
  });

  it("rejects 1 and 21 characters", () => {
    expect(validatePseudo("a")).toEqual({ ok: false, code: "INVALID_PSEUDO" });
    expect(validatePseudo("a".repeat(21))).toEqual({ ok: false, code: "INVALID_PSEUDO" });
  });

  it.each(["bad!", "a<b>", "ab\ncd", "ab\tcd", "ab\u0000cd", "a​b", "😀😀", "ab.cd"])(
    "rejects %j",
    (value) => {
      expect(validatePseudo(value)).toEqual({ ok: false, code: "INVALID_PSEUDO" });
    },
  );

  it.each([
    ["Hangul choseong filler U+115F", "ᅟᅟ"],
    ["Hangul jungseong filler U+1160", "ᅠᅠ"],
    ["Hangul filler U+3164", "ㅤㅤ"],
    ["halfwidth Hangul filler U+FFA0", "ﾠﾠ"],
    ["a filler hidden among letters", "abㅤcd"],
    ["zero width space (Cf)", "ab​cd"],
    ["right-to-left mark (Cf)", "ab‏cd"],
    ["soft hyphen (Cf)", "ab­cd"],
    ["BOM inside the pseudo (Cf)", "ab﻿cd"],
    ["control character (Cc)", "ab\u0007cd"],
    ["line separator (Zl)", "ab cd"],
    ["paragraph separator (Zp)", "ab cd"],
  ])("rejects %s", (_label, value) => {
    expect(validatePseudo(value)).toEqual({ ok: false, code: "INVALID_PSEUDO" });
  });

  it("requires at least one visible letter or digit", () => {
    expect(validatePseudo("__")).toEqual({ ok: false, code: "INVALID_PSEUDO" });
    expect(validatePseudo("- -")).toEqual({ ok: false, code: "INVALID_PSEUDO" });
    expect(validatePseudo("_a")).toEqual({ ok: true, value: "_a" });
    expect(validatePseudo("-7")).toEqual({ ok: true, value: "-7" });
  });

  it("rejects a blank pseudo and non-string values", () => {
    expect(validatePseudo("    ").ok).toBe(false);
    expect(validatePseudo(undefined).ok).toBe(false);
  });
});
