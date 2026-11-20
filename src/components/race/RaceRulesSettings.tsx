import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
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
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
          role="radiogroup"
          aria-labelledby={id("time-limit-label")}
          aria-describedby={id("time-limit-help")}
        >
          <RadioCard
            disabled={readOnly}
            checked={value.timeLimitSeconds === null}
            onChange={() => onChange({ timeLimitSeconds: null })}
            label={dict.timeLimit.none}
            className="justify-center text-center"
          />
          {TIME_LIMITS_SECONDS.map((seconds) => (
            <RadioCard
              key={seconds}
              disabled={readOnly}
              checked={value.timeLimitSeconds === seconds}
              onChange={() => onChange({ timeLimitSeconds: seconds })}
              label={seconds < 60
                ? dict.timeLimit.seconds.replace("{seconds}", numberFormat.format(seconds))
                : dict.timeLimit.minutes.replace("{minutes}", numberFormat.format(seconds / 60))}
              className="justify-center text-center"
            />
          ))}
        </div>
        <p id={id("time-limit-help")} className="mt-2 text-xs leading-relaxed text-muted">{dict.timeLimit.help}</p>
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
