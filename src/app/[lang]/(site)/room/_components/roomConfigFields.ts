import type { SelectOption } from "@/components/SelectField";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  parseRoomConfigPatch,
  TEXT_LANGUAGES,
  TEXT_LENGTHS,
  TEXT_MODES,
  TIME_LIMITS_SECONDS,
  type RoomConfig,
  type RoomConfigPatch,
  type TimeLimitSeconds,
} from "@/realtime/protocol";

export type RoomConfigLabels = Dictionary["room"]["config"];

/** Valeur du `<select>` pour « pas de limite choisie » (`timeLimitSeconds: null`). */
const NO_TIME_LIMIT = "none";

export interface ConfigField {
  key: keyof RoomConfig;
  label: string;
  options: SelectOption[];
  /** Valeur courante, au format des `options`. */
  value: string;
  /** Libellé de la valeur courante, pour la vue en lecture seule. */
  valueLabel: string;
}

function timeLimitLabels(labels: RoomConfigLabels): Record<TimeLimitSeconds, string> {
  return {
    60: labels.timeLimit["60"],
    120: labels.timeLimit["120"],
    180: labels.timeLimit["180"],
    300: labels.timeLimit["300"],
    600: labels.timeLimit["600"],
  };
}

function field(
  key: keyof RoomConfig,
  label: string,
  options: SelectOption[],
  value: string,
): ConfigField {
  return { key, label, options, value, valueLabel: options.find((option) => option.value === value)?.label ?? value };
}

/** Les quatre réglages de la salle (CONFIG-1, 2, 4, 6), avec toutes les valeurs du protocole. */
export function configFields(config: RoomConfig, labels: RoomConfigLabels): ConfigField[] {
  const limits = timeLimitLabels(labels);
  return [
    field(
      "textMode",
      labels.textMode.label,
      TEXT_MODES.map((value) => ({ value, label: labels.textMode[value] })),
      config.textMode,
    ),
    field(
      "language",
      labels.language.label,
      TEXT_LANGUAGES.map((value) => ({ value, label: labels.language[value] })),
      config.language,
    ),
    field(
      "length",
      labels.length.label,
      TEXT_LENGTHS.map((value) => ({ value, label: labels.length[value] })),
      config.length,
    ),
    field(
      "timeLimitSeconds",
      labels.timeLimit.label,
      [
        { value: NO_TIME_LIMIT, label: labels.timeLimit.none },
        ...TIME_LIMITS_SECONDS.map((seconds) => ({ value: String(seconds), label: limits[seconds] })),
      ],
      config.timeLimitSeconds === null ? NO_TIME_LIMIT : String(config.timeLimitSeconds),
    ),
  ];
}

/** Patch à envoyer pour la valeur choisie dans un `<select>`, ou `null` si elle est hors protocole. */
export function configPatch(key: keyof RoomConfig, raw: string): RoomConfigPatch | null {
  if (key === "timeLimitSeconds") {
    return parseRoomConfigPatch({ timeLimitSeconds: raw === NO_TIME_LIMIT ? null : Number(raw) });
  }
  return parseRoomConfigPatch({ [key]: raw });
}
