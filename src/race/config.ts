import { z } from "zod";
import { DEFAULT_CAPACITY, MAX_BOTS, roomConfigFields } from "@/realtime/protocol";
import type { RoomConfig } from "@/realtime/protocol";
import { LEGACY_BOT_LEVEL } from "./bots";

/**
 * CONF-01 à CONF-04, CONF-06 à CONF-10, BOT-01: race settings. Settings share the room's `RoomConfig`, validated by
 * the protocol, so the solo page and the room cannot drift apart (B-D3).
 */
export type RaceSettings = RoomConfig;

export const DEFAULT_RACE_SETTINGS: Readonly<RaceSettings> = Object.freeze<RaceSettings>({
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
  bots: ["intermediate", "intermediate"],
  visibility: "code",
  capacity: DEFAULT_CAPACITY,
  bonuses: false,
});

/** Les champs ajoutés après coup sont facultatifs à la lecture : d'anciens liens `/race?config=` les ignorent. */
export const raceSettingsSchema = z.preprocess((value) => {
  if (typeof value === "object" && value !== null && "abilities" in value && typeof value.abilities === "boolean" && !("bonuses" in value)) {
    const { abilities, ...rest } = value;
    value = { ...rest, bonuses: abilities };
  }
  const legacy = z.object({
    botCount: z.number().int().min(0).max(MAX_BOTS),
    botDifficulty: z.enum(["easy", "normal", "hard"]),
  }).safeParse(value);
  if (!legacy.success || typeof value !== "object" || value === null || "bots" in value) return value;
  const { botCount, botDifficulty, ...rest } = value as Record<string, unknown>;
  void botCount; void botDifficulty;
  return { ...rest, bots: Array.from({ length: legacy.data.botCount }, () => LEGACY_BOT_LEVEL[legacy.data.botDifficulty]) };
}, z.strictObject({
  ...roomConfigFields,
  visibility: roomConfigFields.visibility.default(DEFAULT_RACE_SETTINGS.visibility),
  capacity: roomConfigFields.capacity.default(DEFAULT_CAPACITY),
  complexity: roomConfigFields.complexity.default(DEFAULT_RACE_SETTINGS.complexity),
  punctuation: roomConfigFields.punctuation.default(DEFAULT_RACE_SETTINGS.punctuation),
  numbers: roomConfigFields.numbers.default(DEFAULT_RACE_SETTINGS.numbers),
  uppercase: roomConfigFields.uppercase.default(DEFAULT_RACE_SETTINGS.uppercase),
  bonuses: roomConfigFields.bonuses.default(false),
}));

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
  if (config === undefined) return { ...DEFAULT_RACE_SETTINGS, bots: [...DEFAULT_RACE_SETTINGS.bots] };
  if (typeof config !== "string" || config.length > 2048) return null;
  try {
    return parseRaceSettings(JSON.parse(config));
  } catch {
    return null;
  }
}
