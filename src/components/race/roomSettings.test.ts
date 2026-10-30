import { describe, expect, it } from "vitest";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import { toRaceSettings, toRoomConfig, toRoomConfigPatch } from "./roomSettings";

describe("roomSettings", () => {
  it("toRoomConfig keeps the shared protocol keys", () => {
    const config = toRoomConfig({ ...DEFAULT_RACE_SETTINGS, bonuses: true, bots: ["intermediate", "intermediate", "intermediate", "intermediate"] });
    expect(config).not.toHaveProperty("abilities");
    expect(Object.keys(config).sort()).toEqual(Object.keys(DEFAULT_ROOM_CONFIG).sort());
    expect(config.bots).toHaveLength(4);
    expect(config.bonuses).toBe(true);
  });

  it("toRaceSettings preserves bonuses", () => {
    const config = { ...DEFAULT_ROOM_CONFIG, bonuses: true };
    expect(toRaceSettings(config)).toEqual(config);
  });

  it("toRoomConfigPatch carries bonuses", () => {
    expect(toRoomConfigPatch({ language: "en", bonuses: true })).toEqual({ language: "en", bonuses: true });
  });
});
