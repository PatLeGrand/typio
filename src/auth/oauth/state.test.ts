// @vitest-environment node
import { describe, expect, it } from "vitest";
import { statesMatch } from "./state";

describe("statesMatch", () => {
  it("accepts identical values", () => {
    expect(statesMatch("abc123", "abc123")).toBe(true);
  });

  it("rejects different values, including a different length and a shared prefix", () => {
    expect(statesMatch("abc123", "abc124")).toBe(false);
    expect(statesMatch("abc123", "abc12")).toBe(false);
    expect(statesMatch("abc123", "abc1234")).toBe(false);
  });

  it("rejects a missing or empty value on either side, never matching two empties", () => {
    expect(statesMatch(undefined, "abc")).toBe(false);
    expect(statesMatch("abc", null)).toBe(false);
    expect(statesMatch("", "")).toBe(false);
    expect(statesMatch(undefined, null)).toBe(false);
  });
});
