import { describe, expect, it } from "vitest";
import { TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import { DEFAULT_RACE_SETTINGS, deserializeRaceSettings, getEffectiveTimeLimitSeconds,
  parseRaceSettings, serializeRaceSettings } from "./config";

describe("race settings boundary (CONF-01 à CONF-04, CONF-06 à CONF-10, BOT-01)", () => {
  it("round-trips accents and URL-sensitive exclusions without changing settings", () => {
    const settings = { ...DEFAULT_RACE_SETTINGS, excludedCharacters: "#%&+?é", bots: [] };
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

  it("accepts an old URL without visibility and capacity, filling the defaults", () => {
    const { visibility, capacity, ...old } = DEFAULT_RACE_SETTINGS;
    void visibility; void capacity;
    expect(deserializeRaceSettings(JSON.stringify(old))).toEqual(DEFAULT_RACE_SETTINGS);
    expect(deserializeRaceSettings(JSON.stringify({ ...old, extra: 1 }))).toBeNull();
  });

  it("accepts an old solo config without the CONF-05/CONF-06 fields, filling the defaults", () => {
    const { complexity, punctuation, numbers, uppercase, ...old } = DEFAULT_RACE_SETTINGS;
    void complexity; void punctuation; void numbers; void uppercase;
    expect(deserializeRaceSettings(JSON.stringify(old))).toMatchObject({
      complexity: "medium", punctuation: true, numbers: false, uppercase: true,
    });
    expect(parseRaceSettings({ ...old, complexity: "extreme" })).toBeNull();
  });

  it("refuses an old URL whose duration is not in the list", () => {
    const config = JSON.stringify({ ...DEFAULT_RACE_SETTINGS, timeLimitSeconds: 90 });
    expect(deserializeRaceSettings(config)).toBeNull();
  });

  it.each([-1, 8, 0.5, "2"])("rejects invalid bot count %s", (botCount) => {
    const { bots, ...old } = DEFAULT_RACE_SETTINGS;
    void bots;
    expect(parseRaceSettings({ ...old, botCount, botDifficulty: "normal" })).toBeNull();
  });

  it("converts legacy links and refuses mixed configurations", () => {
    const { bots, ...old } = DEFAULT_RACE_SETTINGS;
    void bots;
    for (const [difficulty, level] of [["easy", "beginner"], ["normal", "intermediate"], ["hard", "expert"]]) {
      expect(deserializeRaceSettings(JSON.stringify({ ...old, botCount: 2, botDifficulty: difficulty })))
        .toMatchObject({ bots: [level, level] });
    }
    for (const legacy of [{ botCount: 2 }, { botDifficulty: "normal" }, { botCount: 2, botDifficulty: "normal" }]) {
      expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, ...legacy })).toBeNull();
    }
    expect(parseRaceSettings({ ...old, botCount: 2 })).toBeNull();
    expect(parseRaceSettings({ ...old, botDifficulty: "normal" })).toBeNull();
  });

  it("converts legacy abilities, including legacy bots, and refuses mixed bonus fields", () => {
    const { bonuses, bots, ...old } = DEFAULT_RACE_SETTINGS;
    void bonuses;
    expect(parseRaceSettings({ ...old, bots, abilities: true })).toMatchObject({ bonuses: true });
    expect(parseRaceSettings({ ...old, abilities: false, botCount: 2, botDifficulty: "normal" }))
      .toEqual(DEFAULT_RACE_SETTINGS);
    expect(parseRaceSettings({ ...DEFAULT_RACE_SETTINGS, abilities: false })).toBeNull();
    expect(parseRaceSettings({ ...old, bots, abilities: "true" })).toBeNull();
    expect(parseRaceSettings({ ...old, bots, abilities: undefined })).toBeNull();
    expect(parseRaceSettings({ ...old, bots })).toMatchObject({ bonuses: false });
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
    settings.bots.push("noob");
    expect(DEFAULT_RACE_SETTINGS.bots).toHaveLength(2);
    expect(parseRaceSettings(DEFAULT_RACE_SETTINGS)).not.toBe(DEFAULT_RACE_SETTINGS);
  });
});
