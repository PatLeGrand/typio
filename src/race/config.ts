import { z } from "zod";
import { DEFAULT_CAPACITY, roomConfigFields } from "@/realtime/protocol";
import type { RoomConfig } from "@/realtime/protocol";

/**
 * CONF-01 à CONF-04, CONF-06 à CONF-10, BOT-01: race settings. Everything but `abilities` is the room's `RoomConfig`, validated by
 * the protocol, so the solo page and the room cannot drift apart (B-D3).
 */
export type RaceSettings = RoomConfig & { abilities: boolean };

export const DEFAULT_RACE_SETTINGS: Readonly<RaceSettings> = Object.freeze({
  textMode: "sentences",
  language: "fr",
  accents: true,
  complexity: "medium",
  punctuation: true,
  numbers: false,
  uppercase: true,
  length: "medium",
  excludedCharacters: "",
  timeLimitSeconds: null,
  inputMode: "free",
  botCount: 2,
  botDifficulty: "normal",
  visibility: "code",
  capacity: DEFAULT_CAPACITY,
  abilities: false,
});

/** Les champs ajoutés après coup sont facultatifs à la lecture : d'anciens liens `/race?config=` les ignorent. */
export const raceSettingsSchema = z.strictObject({
  ...roomConfigFields,
  visibility: roomConfigFields.visibility.default(DEFAULT_RACE_SETTINGS.visibility),
  capacity: roomConfigFields.capacity.default(DEFAULT_CAPACITY),
  complexity: roomConfigFields.complexity.default(DEFAULT_RACE_SETTINGS.complexity),
  punctuation: roomConfigFields.punctuation.default(DEFAULT_RACE_SETTINGS.punctuation),
  numbers: roomConfigFields.numbers.default(DEFAULT_RACE_SETTINGS.numbers),
  uppercase: roomConfigFields.uppercase.default(DEFAULT_RACE_SETTINGS.uppercase),
  abilities: z.boolean(),
});

export function parseRaceSettings(value: unknown): RaceSettings | null {
  const result = raceSettingsSchema.safeParse(value);
  return result.success ? result.data : null;
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
