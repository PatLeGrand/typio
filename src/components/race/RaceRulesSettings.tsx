import { SlidersHorizontal } from "lucide-react";
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

/** Section « règles du jeu » des réglages de course (CONF-07 à CONF-09). */
export function RaceRulesSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel }: RaceRulesSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);

  return (
    <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
          <SlidersHorizontal className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <SectionHeading className="text-xl font-bold text-foreground">{dict.rulesSection.title}</SectionHeading>
          <p className="text-sm text-muted">{dict.rulesSection.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Limite de temps */}
        <fieldset className="border-b border-border pb-8">
          <legend id={id("time-limit-label")} className="text-[15px] font-semibold">{dict.timeLimit.label}</legend>
          <p id={id("time-limit-help")} className="text-sm text-muted mt-1 mb-3">{dict.timeLimit.help}</p>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
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
        </fieldset>

        {/* Mode de saisie */}
        <div>
          <FieldHeading id={id("input-mode-label")} className="text-[15px] font-semibold mb-3">{dict.inputMode.label}</FieldHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-labelledby={id("input-mode-label")}>
            <RadioCard
              layout="vertical"
              disabled={readOnly}
              checked={value.inputMode === "free"}
              onChange={() => onChange({ inputMode: "free" })}
              label={dict.inputMode.free}
              description={dict.inputMode.freeDesc}
            />
            <RadioCard
              layout="vertical"
              disabled={readOnly}
              checked={value.inputMode === "blocking"}
              onChange={() => onChange({ inputMode: "blocking" })}
              label={dict.inputMode.blocking}
              description={dict.inputMode.blockingDesc}
            />
          </div>
        </div>

        {/* Bonus de remontée (CONF-09). */}
        <div className="flex items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="text-accent-text">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
            </div>
            <div>
              <FieldHeading className="text-[15px] font-semibold">{dict.bonuses.label}</FieldHeading>
              <p id={id("bonuses-help")} className="text-sm text-muted mt-1">{dict.bonuses.help}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Switch
              aria-label={dict.bonuses.label}
              aria-describedby={id("bonuses-help")}
              checked={value.bonuses}
              onChange={(bonuses) => onChange({ bonuses })}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
