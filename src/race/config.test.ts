import { describe, expect, it } from "vitest";
import { TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import { DEFAULT_RACE_SETTINGS, deserializeRaceSettings, getEffectiveTimeLimitSeconds,
  parseRaceSettings, serializeRaceSettings } from "./config";

describe("race settings boundary (CONFIG-1..9)", () => {
  it("round-trips accents and URL-sensitive exclusions without changing settings", () => {
    const settings = { ...DEFAULT_RACE_SETTINGS, excludedCharacters: "#%&+?é", botCount: 0 };
    const query = new URLSearchParams(serializeRaceSettings(settings));
    expect(deserializeRaceSettings(query.get("config") ?? undefined)).toEqual(settings);
  });

  it("normalizes excluded characters through the shared room parser", () => {
    expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, excludedCharacters: "a a b" }))
      .toMatchObject({ excludedCharacters: "ab" });
  });

  it.each([0, 1, 90, -1, 601, 1.5, NaN, Infinity, "120"])("rejects duration %s outside the protocol list", (timeLimitSeconds) => {
    expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds })).toBeNull();
  });

  it.each([null, ...TIME_LIMITS_SECONDS])("accepts duration %s", (timeLimitSeconds) => {
    expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds })).toMatchObject({ timeLimitSeconds });
  });

  it("refuses an old URL whose duration is not in the list", () => {
    const config = JSON.stringify({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: 90 });
    expect(deserializeRaceSettings(config)).toBeNull();
  });

  it.each([-1, 8, 0.5, "2"])("rejects invalid bot count %s", (botCount) => {
    expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, botCount })).toBeNull();
  });

  it("uses the documented default limit, including when explicit limit is off", () => {
    expect(getEffectiveTimeLimitSeconds(DEFAULT_RACE_SETTINGS)).toBe(300);
    expect(getEffectiveTimeLimitSeconds({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: 60 })).toBe(60);
  });

  it.each([null, [], {}, { ...DEFAULT_RACE_SETTINGS, hostId: "forged" },
    { ...DEFAULT_RACE_SETTINGS, language: "de" },
    { ...DEFAULT_RACE_SETTINGS, accents: "true" },
    { ...DEFAULT_RACE_SETTINGS, excludedCharacters: "x".repeat(101) }])("rejects malformed objects", (value) => {
    expect(parseRaceSettings(value)).toBeNull();
  });

  it.each(["{", "null", "", "x".repeat(2049), ["{}", "{}"]])("rejects malformed query values", (value) => {
    expect(deserializeRaceSettings(value)).toBeNull();
  });

  it("returns independent defaults and parsed objects", () => {
    const settings = deserializeRaceSettings(undefined);
    if (!settings) throw new Error("Missing defaults");
    settings.botCount = 0;
    expect(DEFAULT_RACE_SETTINGS.botCount).toBe(2);
    expect(parseRaceSettings(DEFAULT_RACE_SETTINGS)).not.toBe(DEFAULT_RACE_SETTINGS);
  });
});
