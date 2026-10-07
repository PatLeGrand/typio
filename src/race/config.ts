/** CONFIG-1..9: local race preparation, separate from the frozen room protocol. */
export interface RaceSettings {
  textMode: "sentences" | "words";
  language: "fr" | "en";
  accents: boolean;
  length: "short" | "medium" | "long";
  excludedCharacters: string;
  timeLimitSeconds: number | null;
  inputMode: "free" | "blocking";
  botCount: number;
  botDifficulty: "easy" | "normal" | "hard";
  abilities: boolean;
}

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
  const { textMode, language, accents, length, excludedCharacters, timeLimitSeconds,
    inputMode, botCount, botDifficulty, abilities } = settings;
  if (
    (textMode !== "sentences" && textMode !== "words") ||
    (language !== "fr" && language !== "en") ||
    typeof accents !== "boolean" ||
    (length !== "short" && length !== "medium" && length !== "long") ||
    typeof excludedCharacters !== "string" || excludedCharacters.length > 100 ||
    (timeLimitSeconds !== null && (typeof timeLimitSeconds !== "number" ||
      !Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 1 || timeLimitSeconds > 600)) ||
    (inputMode !== "free" && inputMode !== "blocking") ||
    typeof botCount !== "number" || !Number.isInteger(botCount) || botCount < 0 || botCount > 7 ||
    (botDifficulty !== "easy" && botDifficulty !== "normal" && botDifficulty !== "hard") ||
    typeof abilities !== "boolean"
  ) return null;
  return { textMode, language, accents, length, excludedCharacters, timeLimitSeconds,
    inputMode, botCount, botDifficulty, abilities };
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
