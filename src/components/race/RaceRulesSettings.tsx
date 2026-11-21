"use client";

import { useEffect, useState } from "react";
import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import {
  DEFAULT_KEY_SOUND_SET,
  KEY_SOUND_CHANGE_EVENT,
  KEY_SOUND_SETS,
  KEY_SOUND_STORAGE_KEY,
  playKeySoundPreview,
  readKeySoundSet,
  writeKeySoundSet,
  type KeySoundSet,
} from "@/race/keySounds";
import { TIME_LIMITS_SECONDS } from "@/realtime/protocol";

type RaceRulesSettingsProps = {
  value: RaceSettings;
  onChange: (patch: Partial<RaceSettings>) => void;
  readOnly: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  /** Préfixe d'identifiants issu du `useId` de `RaceSettingsFields`. */
  idPrefix: string;
  headingLevel: 2 | 3;
};

/** Réglage essentiel des règles du jeu : la limite de temps (CONF-07). */
export function RaceRulesSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel }: RaceRulesSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);
  const [keySoundSet, setKeySoundSet] = useState<KeySoundSet>(DEFAULT_KEY_SOUND_SET);

  useEffect(() => {
    const syncKeySoundSet = () => setKeySoundSet(readKeySoundSet());
    syncKeySoundSet();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === KEY_SOUND_STORAGE_KEY) {
        syncKeySoundSet();
      }
    };
    window.addEventListener(KEY_SOUND_CHANGE_EVENT, syncKeySoundSet);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(KEY_SOUND_CHANGE_EVENT, syncKeySoundSet);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <section className="flex flex-col gap-4 border-t border-border/80 pt-6">
      <div>
        <SectionHeading
          className={headingLevel === 3 ? "text-base font-bold text-foreground" : "font-display text-[1.65rem] font-black leading-none tracking-[-0.01em] text-foreground"}
        >
          {dict.rulesSection.title}
        </SectionHeading>
        <p className="mt-1 text-sm text-muted">{dict.rulesSection.subtitle}</p>
      </div>

      {/* Limite de temps */}
      <fieldset>
        <legend id={id("time-limit-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.timeLimit.label}</legend>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={id("time-limit-label")}
          aria-describedby={id("time-limit-help")}
        >
          <RadioCard
            fullWidth={false}
            disabled={readOnly}
            checked={value.timeLimitSeconds === null}
            onChange={() => onChange({ timeLimitSeconds: null })}
            label={dict.timeLimit.none}
            className="flex-1 justify-center px-3.5 text-center whitespace-nowrap sm:flex-none"
          />
          {TIME_LIMITS_SECONDS.map((seconds) => (
            <RadioCard
              key={seconds}
              fullWidth={false}
              disabled={readOnly}
              checked={value.timeLimitSeconds === seconds}
              onChange={() => onChange({ timeLimitSeconds: seconds })}
              label={seconds < 60
                ? dict.timeLimit.seconds.replace("{seconds}", numberFormat.format(seconds))
                : dict.timeLimit.minutes.replace("{minutes}", numberFormat.format(seconds / 60))}
              className="flex-1 justify-center px-3.5 text-center whitespace-nowrap sm:flex-none"
            />
          ))}
        </div>
        <p id={id("time-limit-help")} className="mt-2 text-xs leading-relaxed text-muted">{dict.timeLimit.help}</p>
      </fieldset>

      {/* Sons des touches (préférence personnelle locale, modifiable par chaque joueur même en lecture seule) */}
      <fieldset>
        <legend id={id("key-sounds-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.keySounds.label}</legend>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-labelledby={id("key-sounds-label")}
          aria-describedby={id("key-sounds-help")}
        >
          {KEY_SOUND_SETS.map((set) => (
            <RadioCard
              key={set}
              fullWidth={false}
              disabled={false}
              checked={keySoundSet === set}
              onChange={() => {
                setKeySoundSet(set);
                writeKeySoundSet(set);
                playKeySoundPreview(set);
              }}
              label={dict.keySounds.sets[set]}
              className="flex-1 justify-center px-3.5 text-center whitespace-nowrap sm:flex-none"
            />
          ))}
        </div>
        <p id={id("key-sounds-help")} className="mt-2 text-xs leading-relaxed text-muted">{dict.keySounds.help}</p>
      </fieldset>
    </section>
  );
}

/** Options avancées des règles du jeu : mode de saisie et bonus de remontée (CONF-08, CONF-09). */
export function RaceAdvancedRulesSettings({ value, onChange, readOnly, dict, idPrefix, headingLevel }: Omit<RaceRulesSettingsProps, "lang">) {
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Mode de saisie : description affichée uniquement pour l'option choisie */}
      <div>
        <FieldHeading id={id("input-mode-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.inputMode.label}</FieldHeading>
        <div
          className="grid grid-cols-2 gap-2.5"
          role="radiogroup"
          aria-labelledby={id("input-mode-label")}
          aria-describedby={id("input-mode-help")}
        >
          <RadioCard
            disabled={readOnly}
            checked={value.inputMode === "free"}
            onChange={() => onChange({ inputMode: "free" })}
            label={dict.inputMode.free}
          />
          <RadioCard
            disabled={readOnly}
            checked={value.inputMode === "blocking"}
            onChange={() => onChange({ inputMode: "blocking" })}
            label={dict.inputMode.blocking}
          />
        </div>
        <p id={id("input-mode-help")} className="mt-2 text-xs leading-relaxed text-muted">
          {value.inputMode === "free" ? dict.inputMode.freeDesc : dict.inputMode.blockingDesc}
        </p>
      </div>

      {/* Bonus de remontée (CONF-09) */}
      <div className="flex items-start justify-between gap-4 border-t border-border/70 pt-5">
        <div className="min-w-0">
          <FieldHeading className="text-sm font-semibold text-foreground">{dict.bonuses.label}</FieldHeading>
          <p id={id("bonuses-help")} className="mt-1 text-xs leading-relaxed text-muted">{dict.bonuses.help}</p>
        </div>
        <Switch
          aria-label={dict.bonuses.label}
          aria-describedby={id("bonuses-help")}
          checked={value.bonuses}
          onChange={(bonuses) => onChange({ bonuses })}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
