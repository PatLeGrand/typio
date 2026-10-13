import { DEFAULT_ROOM_CONFIG, parseRoomConfigPatch } from "@/realtime/protocol";
import type { RoomConfig } from "@/realtime/protocol";

/**
 * CONFIG-1..9: race settings. Everything but `abilities` is the room's `RoomConfig`, validated by
 * the protocol, so the solo page and the room cannot drift apart (B-D3).
 */
export type RaceSettings = RoomConfig & { abilities: boolean };

export const DEFAULT_RACE_SETTINGS: Readonly<RaceSettings> = Object.freeze({
  textMode: "sentences",
  language: "fr",
  accents: true,
  length: "medium",
  excludedCharacters: "",
  timeLimitSeconds: null,
  inputMode: "free",
  botCount: 2,
  botDifficulty: "normal",
  abilities: false,
});

export function parseRaceSettings(value: unknown): RaceSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(DEFAULT_RACE_SETTINGS);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) return null;
  const settings = value as Record<string, unknown>;
  const { abilities, ...roomConfig } = settings;
  const parsedRoomConfig = parseRoomConfigPatch(roomConfig);
  if (parsedRoomConfig === null || typeof abilities !== "boolean") return null;
  return { ...DEFAULT_ROOM_CONFIG, ...parsedRoomConfig, abilities };
}

/** H-9: disabling an explicit limit keeps the five-minute safety limit. */
export function getEffectiveTimeLimitSeconds(settings: RaceSettings): number {
  return settings.timeLimitSeconds ?? 300;
}

export function serializeRaceSettings(settings: RaceSettings): string {
  const validated = parseRaceSettings(settings);
  if (!validated) throw new Error("INVALID_RACE_SETTINGS");
  return new URLSearchParams({ config: JSON.stringify(validated) }).toString();
}

/** Reject malformed or repeated URL parameters rather than silently changing the rules. */
export function deserializeRaceSettings(config: string | string[] | undefined): RaceSettings | null {
  if (config === undefined) return { ...DEFAULT_RACE_SETTINGS };
  if (typeof config !== "string" || config.length > 2048) return null;
  try {
    return parseRaceSettings(JSON.parse(config));
  } catch {
    return null;
  }
}
