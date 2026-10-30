import { describe, expect, it } from "vitest";
import {
  MAX_EXCLUDED_CHARACTERS,
  normalizeExcludedCharacters,
  parseCreatePayload,
  parseJoinPayload,
  parseRoomConfigPatch,
} from "./protocol";

describe("parseCreatePayload", () => {
  it("defaults to an empty config and runner role", () => {
    expect(parseCreatePayload({})).toEqual({ config: {}, role: "runner" });
    expect(parseCreatePayload({ config: { language: "en" } })).toEqual({
      config: { language: "en" }, role: "runner",
    });
  });

  it.each(["runner", "spectator"])("accepts the %s role and validates the config", (role) => {
    expect(parseCreatePayload({ role })).toEqual({ config: {}, role });
    expect(parseCreatePayload({ config: { excludedCharacters: "b a b" }, role })).toEqual({
      config: { excludedCharacters: "ab" }, role,
    });
  });

  it.each([
    undefined, null, [], "runner",
    { role: "host" }, { role: null },
    { hostId: "x" },
    { config: { language: "de" } }, { config: { hostId: "x" } }, { config: null },
  ])("rejects an invalid create payload: %o", (payload) => {
    expect(parseCreatePayload(payload)).toBeNull();
  });
});

describe("parseRoomConfigPatch", () => {
  it("validates bonuses strictly without accepting legacy or client-decided bonuses", () => {
    for (const bonuses of [true, false]) {
      expect(parseRoomConfigPatch({ bonuses })).toEqual({ bonuses });
      expect(parseCreatePayload({ config: { bonuses } })).toEqual({ config: { bonuses }, role: "runner" });
    }
    for (const value of [{ bonuses: "true" }, { bonuses: null }, { bonuses: undefined },
      { abilities: true }, { bonusEvents: [] }, { text: "triché" }]) {
      expect(parseRoomConfigPatch(value)).toBeNull();
    }
  });

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
      bots: ["noob", "beginner", "intermediate", "expert", "impossible", "noob", "expert"],
    })).toEqual({
      accents: false,
      excludedCharacters: "ab",
      inputMode: "blocking",
      bots: ["noob", "beginner", "intermediate", "expert", "impossible", "noob", "expert"],
    });
  });

  it("accepts the complexity and text options (CONF-05, CONF-06)", () => {
    const patch = { complexity: "hard", punctuation: false, numbers: true, uppercase: false };
    expect(parseRoomConfigPatch(patch)).toEqual(patch);
    for (const complexity of ["easy", "medium", "hard"]) {
      expect(parseRoomConfigPatch({ complexity })).toEqual({ complexity });
    }
  });

  it.each([
    { complexity: "expert" },
    { complexity: undefined },
    { punctuation: "yes" },
    { numbers: 1 },
    { uppercase: null },
  ])("refuses invalid complexity or text options: %o", (patch) => {
    expect(parseRoomConfigPatch(patch)).toBeNull();
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
    { bots: Array(8).fill("noob") },
    { bots: ["unknown"] },
    { bots: "intermediate" },
    { bots: [1] },
    { bots: null },
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

describe("parseRoomConfigPatch bots", () => {
  it.each([{ bots: Array(8).fill("noob") }, { bots: ["unknown"] }, { bots: undefined },
    { botCount: 0 }, { botDifficulty: "normal" }, { bots: [], botCount: 0, botDifficulty: "normal" }])("rejects invalid or legacy bot settings %o", (patch) => {
    expect(parseRoomConfigPatch(patch)).toBeNull();
    expect(parseCreatePayload({ config: patch })).toBeNull();
  });
  it("accepts an empty list", () => {
    expect(parseRoomConfigPatch({ bots: [] })).toEqual({ bots: [] });
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
