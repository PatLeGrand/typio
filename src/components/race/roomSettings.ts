import type { RaceSettings } from "@/race/config";
import type { RoomConfig, RoomConfigPatch } from "@/realtime/protocol";

/** Réglages de course d'une salle : `abilities` (CONFIG-9) n'existe pas encore côté salle, il reste faux. */
export function toRaceSettings(config: RoomConfig): RaceSettings {
  return { ...config, abilities: false };
}

/** Réglages envoyés à `room:create` : tous, sauf `abilities`. */
export function toRoomConfig(settings: RaceSettings): RoomConfig {
  return {
    textMode: settings.textMode,
    language: settings.language,
    length: settings.length,
    timeLimitSeconds: settings.timeLimitSeconds,
    accents: settings.accents,
    excludedCharacters: settings.excludedCharacters,
    inputMode: settings.inputMode,
    botCount: settings.botCount,
    botDifficulty: settings.botDifficulty,
  };
}

/** Patch envoyé à `room:updateConfig` : seulement des clés du protocole, jamais `abilities`. */
export function toRoomConfigPatch(patch: Partial<RaceSettings>): RoomConfigPatch {
  const { abilities, ...roomPatch } = patch;
  void abilities;
  return roomPatch;
}
