import { describe, expect, it } from "vitest";
import {
  MAX_EXCLUDED_CHARACTERS,
  normalizeExcludedCharacters,
  parseJoinPayload,
  parseRoomConfigPatch,
} from "./protocol";

describe("parseRoomConfigPatch", () => {
  it("accepts an empty or partial valid patch", () => {
    expect(parseRoomConfigPatch(undefined)).toEqual({});
    expect(parseRoomConfigPatch({ language: "en", timeLimitSeconds: null })).toEqual({
      language: "en",
      timeLimitSeconds: null,
    });
  });

  it("accepts each new room setting", () => {
    expect(parseRoomConfigPatch({
      accents: false,
      excludedCharacters: "a a b",
      inputMode: "blocking",
      botCount: 7,
      botDifficulty: "hard",
    })).toEqual({
      accents: false,
      excludedCharacters: "ab",
      inputMode: "blocking",
      botCount: 7,
      botDifficulty: "hard",
    });
  });

  it("refuses unknown keys, out-of-list values and non-objects", () => {
    expect(parseRoomConfigPatch({ hostId: "x" })).toBeNull();
    expect(parseRoomConfigPatch({ language: "de" })).toBeNull();
    expect(parseRoomConfigPatch({ timeLimitSeconds: 7 })).toBeNull();
    expect(parseRoomConfigPatch([])).toBeNull();
    expect(parseRoomConfigPatch("fr")).toBeNull();
  });

  it.each([
    { accents: "true" },
    { inputMode: "fast" },
    { botCount: 8 },
    { botCount: -1 },
    { botCount: 1.5 },
    { botCount: "2" },
    { botCount: Infinity },
    { botDifficulty: "expert" },
    { excludedCharacters: "x".repeat(101) },
    { excludedCharacters: 1 },
  ])("refuses invalid new room settings: %o", (patch) => {
    expect(parseRoomConfigPatch(patch)).toBeNull();
  });
});

describe("normalizeExcludedCharacters", () => {
  it("removes spaces and duplicates, then sorts the characters", () => {
    expect(normalizeExcludedCharacters("a b a")).toBe("ab");
    // L'h\u00f4te ne choisit pas l'ordre : un mot ne reste pas lisible.
    expect(normalizeExcludedCharacters("salope")).toBe("aelops");
    // Ni la casse : les majuscules ne passent plus devant les minuscules.
    expect(normalizeExcludedCharacters("FUck")).toBe("cfku");
    expect(normalizeExcludedCharacters("ÉŒ")).toBe("éœ");
  });

  it("keeps French accents in NFC form", () => {
    expect(normalizeExcludedCharacters("e\u0301 \u00e0")).toBe("\u00e0\u00e9");
  });

  it("drops characters the text generator never produces", () => {
    // Pleine chasse, gras math\u00e9matique, blancs visibles, \u00e9moji, contr\u00f4les bidi, surrogate isol\u00e9.
    expect(normalizeExcludedCharacters("\uff46\uff55\uff43\uff4b\ud835\udc13\ud835\udc14\u2800\u3164\ud83d\udd95\u202e\u2066\uD800")).toBe("");
    // Les diacritiques combinants ne s'empilent pas.
    expect(normalizeExcludedCharacters("a\u0301\u0302\u0303")).toBe("\u00e1");
  });

  it("keeps ASCII and French punctuation", () => {
    expect(normalizeExcludedCharacters("\u00ab \u00bb \u2019 \u2026 \u2013 \u2014 ? & #")).toBe("#&?\u00ab\u00bb\u2013\u2014\u2019\u2026");
  });

  it("rejects inputs longer than the raw length limit", () => {
    expect(normalizeExcludedCharacters("x".repeat(101))).toBeNull();
  });

  it("keeps at most 30 unique characters", () => {
    const input = "zyxwvutsrqponmlkjihgfedcba0123456789";
    expect(normalizeExcludedCharacters(input)).toHaveLength(MAX_EXCLUDED_CHARACTERS);
    expect(normalizeExcludedCharacters(input)).toBe("0123abcdefghijklmnopqrstuvwxyz");
  });
});

describe("parseRoomConfigPatch botCount", () => {
  it("turns -0 into 0", () => {
    expect(Object.is(parseRoomConfigPatch({ botCount: -0 })?.botCount, 0)).toBe(true);
  });
});

describe("parseJoinPayload", () => {
  it("normalizes the code", () => {
    expect(parseJoinPayload({ code: "abc def", role: "runner" })).toEqual({ code: "ABCDEF", role: "runner" });
  });

  it("distinguishes a malformed code from a malformed payload", () => {
    expect(parseJoinPayload({ code: "ABC", role: "runner" })).toBe("INVALID_CODE");
    expect(parseJoinPayload({ code: "ABCDEF", role: "host" })).toBe("INVALID_PAYLOAD");
    expect(parseJoinPayload(null)).toBe("INVALID_PAYLOAD");
  });
});
