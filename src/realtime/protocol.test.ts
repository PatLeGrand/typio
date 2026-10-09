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
    { botDifficulty: "expert" },
    { excludedCharacters: "x".repeat(101) },
    { excludedCharacters: 1 },
  ])("refuses invalid new room settings: %o", (patch) => {
    expect(parseRoomConfigPatch(patch)).toBeNull();
  });
});

describe("normalizeExcludedCharacters", () => {
  it("removes spaces and duplicates while preserving the first occurrence", () => {
    expect(normalizeExcludedCharacters("a b a")).toBe("ab");
  });

  it("normalizes Unicode to NFC", () => {
    const input = "\u00e9\u0301";
    expect(normalizeExcludedCharacters(input)).toBe(input.normalize("NFC"));
  });

  it("rejects inputs longer than the raw length limit", () => {
    expect(normalizeExcludedCharacters("x".repeat(101))).toBeNull();
  });

  it("keeps only the first 30 unique characters", () => {
    const input = Array.from({ length: 40 }, (_, index) => String.fromCodePoint(0x1000 + index)).join("");
    expect(Array.from(normalizeExcludedCharacters(input) ?? "")).toHaveLength(MAX_EXCLUDED_CHARACTERS);
    expect(normalizeExcludedCharacters(input)).toBe(Array.from(input).slice(0, MAX_EXCLUDED_CHARACTERS).join(""));
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
