import { describe, expect, it } from "vitest";
import { DEFAULT_RACE_SETTINGS } from "@/race/config";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import { toRaceSettings, toRoomConfig, toRoomConfigPatch } from "./roomSettings";

describe("roomSettings", () => {
  it("toRoomConfig drops abilities and keeps the nine protocol keys", () => {
    const config = toRoomConfig({ ...DEFAULT_RACE_SETTINGS, botCount: 4 });
    expect(config).not.toHaveProperty("abilities");
    expect(Object.keys(config).sort()).toEqual(Object.keys(DEFAULT_ROOM_CONFIG).sort());
    expect(config.botCount).toBe(4);
  });

  it("toRaceSettings adds abilities: false", () => {
    expect(toRaceSettings(DEFAULT_ROOM_CONFIG)).toEqual({ ...DEFAULT_ROOM_CONFIG, abilities: false });
  });

  it("toRoomConfigPatch never carries abilities", () => {
    expect(toRoomConfigPatch({ language: "en", abilities: true })).toEqual({ language: "en" });
  });
});
