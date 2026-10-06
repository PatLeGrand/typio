import { describe, expect, it } from "vitest";
import { parseJoinPayload, parseRoomConfigPatch } from "./protocol";

describe("parseRoomConfigPatch", () => {
  it("accepts an empty or partial valid patch", () => {
    expect(parseRoomConfigPatch(undefined)).toEqual({});
    expect(parseRoomConfigPatch({ language: "en", timeLimitSeconds: null })).toEqual({
      language: "en",
      timeLimitSeconds: null,
    });
  });

  it("refuses unknown keys, out-of-list values and non-objects", () => {
    expect(parseRoomConfigPatch({ hostId: "x" })).toBeNull();
    expect(parseRoomConfigPatch({ language: "de" })).toBeNull();
    expect(parseRoomConfigPatch({ timeLimitSeconds: 7 })).toBeNull();
    expect(parseRoomConfigPatch([])).toBeNull();
    expect(parseRoomConfigPatch("fr")).toBeNull();
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
