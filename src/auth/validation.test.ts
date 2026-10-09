import { describe, expect, it } from "vitest";
import { pseudoSkeleton, validateNewPassword, validatePassword, validatePseudo, validateUsername } from "./validation";

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

describe("validateNewPassword", () => {
  it("accepts a password with at least one letter and one digit", () => {
    expect(validateNewPassword("abcdefg1")).toEqual({ ok: true, value: "abcdefg1" });
    expect(validateNewPassword("1234567a").ok).toBe(true);
  });

  it("accepts non-ASCII letters and digits", () => {
    expect(validateNewPassword("éclair٣٤٥").ok).toBe(true); // lettre accentuée + chiffres arabo-indiens
    expect(validateNewPassword("пароль12").ok).toBe(true);
  });

  it("rejects a password without a letter or without a digit", () => {
    expect(validateNewPassword("12345678")).toEqual({ ok: false, code: "INVALID_PASSWORD" });
    expect(validateNewPassword("abcdefgh")).toEqual({ ok: false, code: "INVALID_PASSWORD" });
    expect(validateNewPassword("!!!!????")).toEqual({ ok: false, code: "INVALID_PASSWORD" });
  });

  it("does not count roman numerals or superscripts as digits (Nd only)", () => {
    expect(validateNewPassword("abcdefgⅣ")).toEqual({ ok: false, code: "INVALID_PASSWORD" });
    expect(validateNewPassword("abcdefg²")).toEqual({ ok: false, code: "INVALID_PASSWORD" });
  });

  it("keeps the 8 to 128 code point bounds", () => {
    expect(validateNewPassword("abcde12").ok).toBe(false);
    expect(validateNewPassword(`a1${"b".repeat(126)}`).ok).toBe(true);
    expect(validateNewPassword(`a1${"b".repeat(127)}`).ok).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(validateNewPassword(undefined).ok).toBe(false);
    expect(validateNewPassword(["abcdefg1"]).ok).toBe(false);
  });

  it("leaves validatePassword (login) unchanged: no letter/digit requirement", () => {
    expect(validatePassword("12345678").ok).toBe(true);
    expect(validatePassword("abcdefgh").ok).toBe(true);
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

/** Construit une chaîne à partir de points de code, pour que les homoglyphes restent lisibles ici. */
function codePoints(...values: Array<number | string>): string {
  return values.map((value) => (typeof value === "number" ? String.fromCodePoint(value) : value)).join("");
}

describe("validatePseudo: homoglyphs (AUTH-4)", () => {
  it.each([
    ["Cyrillic а (U+0430) in place of a", codePoints(0x430, "lice")],
    ["fullwidth ａｌｉｃｅ (U+FF41…)", codePoints(0xff41, 0xff4c, 0xff49, 0xff43, 0xff45)],
    ["Greek ο (U+03BF) in place of o", codePoints("b", 0x3bf, "b")],
    ["Greek Α (U+0391) in place of A", codePoints(0x391, "lice")],
    ["Cyrillic й, accented but not Latin", codePoints(0x439, "ura")],
    ["Latin alpha ɑ (U+0251)", codePoints(0x251, "lice")],
    ["dotless ı (U+0131)", codePoints("al", 0x131, "ce")],
    ["small capital ᴀ (U+1D00)", codePoints(0x1d00, "lice")],
    ["mathematical bold 𝐚 (U+1D41A)", codePoints(0x1d41a, "lice")],
    ["non-ASCII digit ٣ (U+0663)", codePoints("bob", 0x663)],
    ["superscript ² (U+00B2)", codePoints("bob", 0xb2)],
    ["stray combining mark after an accented letter", codePoints("Zo", 0xe9, 0x301)],
    ["combining mark outside the Latin diacritics", codePoints("a", 0x20dd, "b")],
    ["a diacritic with no precomposed form (q + U+0301)", codePoints("bq", 0x301)],
  ])("rejects %s", (_label, value) => {
    expect(validatePseudo(value)).toEqual({ ok: false, code: "INVALID_PSEUDO" });
  });

  it.each(["Zoé", "Éloïse", "François", "Noël", "Lætitia", "Cœur de lion", "Ãngel_ñ-2"])(
    "accepts the legitimate Latin pseudo %j",
    (value) => {
      expect(validatePseudo(value)).toEqual({ ok: true, value });
    },
  );

  it("folds the Kelvin sign (U+212A) into K through NFC", () => {
    expect(validatePseudo(codePoints(0x212a, "evin"))).toEqual({ ok: true, value: "Kevin" });
  });
});

describe("pseudoSkeleton", () => {
  it.each([
    ["Alice", "alice"],
    ["Àlice", "alice"],
    ["ALICÉ", "alice"],
    ["Éloïse", "eloise"],
    ["Lætitia", "laetitia"],
    ["Cœur de lion", "coeur de lion"],
    ["ŒDIPE_2", "oedipe_2"],
  ])("maps %j to %j", (pseudo, skeleton) => {
    expect(pseudoSkeleton(pseudo)).toBe(skeleton);
  });

  it("returns ASCII for every pseudo validatePseudo accepts", () => {
    for (const value of ["Zoé", "Éloïse", "Ãngel_ñ-2", "Ŵŷ Ç"]) {
      const result = validatePseudo(value);
      if (!result.ok) throw new Error(`expected ${value} to be valid`);
      expect(pseudoSkeleton(result.value)).toMatch(/^[a-z0-9 _-]+$/);
    }
  });
});
