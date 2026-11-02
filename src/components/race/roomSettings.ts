import type { RaceSettings } from "@/race/config";
import type { RoomConfig, RoomConfigPatch } from "@/realtime/protocol";

/** Réglages partagés entre la salle et la course. */
export function toRaceSettings(config: RoomConfig): RaceSettings {
  return { ...config };
}

/** Réglages envoyés à `room:create`. */
export function toRoomConfig(settings: RaceSettings): RoomConfig {
  return {
    textMode: settings.textMode,
    language: settings.language,
    length: settings.length,
    timeLimitSeconds: settings.timeLimitSeconds,
    accents: settings.accents,
    bonuses: settings.bonuses,
    complexity: settings.complexity,
    punctuation: settings.punctuation,
    numbers: settings.numbers,
    uppercase: settings.uppercase,
    excludedCharacters: settings.excludedCharacters,
    inputMode: settings.inputMode,
    bots: settings.bots,
    visibility: settings.visibility,
    capacity: settings.capacity,
  };
}

/** Patch envoyé à `room:updateConfig`. */
export function toRoomConfigPatch(patch: Partial<RaceSettings>): RoomConfigPatch {
  return patch;
}
