"use client";

import { useId } from "react";
import { Bot, SlidersHorizontal, Type } from "lucide-react";
import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlural } from "@/race/format";
import type { RaceSettings } from "@/race/config";
import { MAX_BOTS, TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import type { TimeLimitSeconds } from "@/realtime/protocol";

interface RaceSettingsFieldsProps {
  value: RaceSettings;
  /** Reçoit uniquement les clés modifiées par le contrôle manipulé. */
  onChange: (patch: Partial<RaceSettings>) => void;
  /** Mêmes sections et mêmes valeurs, contrôles inactifs (non-hôte d'une salle, SALLE-10). */
  readOnly?: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  /** Message d'erreur du champ des caractères exclus, déjà traduit. */
  excludedError?: string | null;
  /** Le champ des caractères exclus perd le focus (la salle envoie alors son patch). */
  onExcludedBlur?: () => void;
  /** Niveau des titres de section : 2 sur la page de paramètres, 3 sous le titre de la salle. */
  headingLevel?: 2 | 3;
}

/** Fills the localized "{minutes} min" template from a duration in seconds. */
function formatMinutes(template: string, seconds: TimeLimitSeconds): string {
  return template.replace("{minutes}", String(seconds / 60));
}

/**
 * Les trois sections de réglages de course (CONFIG-1 à 9), contrôlées par `value`. Partagées par la
 * page de paramètres (état local) et la salle d'attente (état de la salle, lecture seule hors hôte).
 */
export function RaceSettingsFields({
  value,
  onChange,
  readOnly = false,
  dict,
  lang,
  excludedError = null,
  onExcludedBlur,
  headingLevel = 2,
}: RaceSettingsFieldsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const excludedCount = new Set(Array.from(value.excludedCharacters).filter((character) => !/\s/u.test(character))).size;

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION 1: TEXTE A TAPER */}
      <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
            <Type className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <SectionHeading className="text-xl font-bold text-foreground">{dict.textSection.title}</SectionHeading>
            <p className="text-sm text-muted">{dict.textSection.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
          {/* Type de texte */}
          <div>
            <FieldHeading id={id("text-mode-label")} className="text-[15px] font-semibold mb-3">{dict.textMode.label}</FieldHeading>
            <div className="flex gap-3" role="radiogroup" aria-labelledby={id("text-mode-label")}>
              <RadioCard
                disabled={readOnly}
                checked={value.textMode === "sentences"}
                onChange={() => onChange({ textMode: "sentences" })}
                label={dict.textMode.sentences}
              />
              <RadioCard
                disabled={readOnly}
                checked={value.textMode === "words"}
                onChange={() => onChange({ textMode: "words" })}
                label={dict.textMode.words}
              />
            </div>
          </div>

          {/* Langue */}
          <div>
            <FieldHeading id={id("language-label")} className="text-[15px] font-semibold mb-3">{dict.language.label}</FieldHeading>
            <div className="flex gap-3" role="radiogroup" aria-labelledby={id("language-label")}>
              <RadioCard
                disabled={readOnly}
                checked={value.language === "fr"}
                onChange={() => onChange({ language: "fr" })}
                label={dict.language.fr}
              />
              <RadioCard
                disabled={readOnly}
                checked={value.language === "en"}
                onChange={() => onChange({ language: "en" })}
                label={dict.language.en}
              />
            </div>
          </div>

          {/* Accents */}
          <div>
            <FieldHeading id={id("accents-label")} className="text-[15px] font-semibold mb-3">{dict.accents.label}</FieldHeading>
            <div className="flex gap-3" role="radiogroup" aria-labelledby={id("accents-label")}>
              <RadioCard
                disabled={readOnly}
                checked={value.accents === true}
                onChange={() => onChange({ accents: true })}
                label={dict.accents.include}
              />
              <RadioCard
                disabled={readOnly}
                checked={value.accents === false}
                onChange={() => onChange({ accents: false })}
                label={dict.accents.exclude}
              />
            </div>
          </div>

          {/* Longueur */}
          <div>
            <FieldHeading id={id("length-label")} className="text-[15px] font-semibold mb-3">{dict.length.label}</FieldHeading>
            <div className="flex gap-3" role="radiogroup" aria-labelledby={id("length-label")}>
              <RadioCard
                disabled={readOnly}
                checked={value.length === "short"}
                onChange={() => onChange({ length: "short" })}
                label={dict.length.short}
              />
              <RadioCard
                disabled={readOnly}
                checked={value.length === "medium"}
                onChange={() => onChange({ length: "medium" })}
                label={dict.length.medium}
              />
              <RadioCard
                disabled={readOnly}
                checked={value.length === "long"}
                onChange={() => onChange({ length: "long" })}
                label={dict.length.long}
              />
            </div>
          </div>

          {/* Caractères exclus */}
          <div className="sm:col-span-2">
            <FieldHeading className="text-[15px] font-semibold mb-3">{dict.excludedChars.label}</FieldHeading>
            <div className="relative">
              <input
                type="text"
                aria-label={dict.excludedChars.label}
                aria-invalid={Boolean(excludedError)}
                aria-describedby={`${id("excluded-chars-count")} ${id("excluded-chars-help")}${excludedError ? ` ${id("excluded-chars-error")}` : ""}`}
                value={value.excludedCharacters}
                readOnly={readOnly}
                onChange={(event) => onChange({ excludedCharacters: event.target.value })}
                onBlur={onExcludedBlur}
                placeholder={readOnly ? undefined : dict.excludedChars.placeholder}
                className="w-full h-12 px-4 rounded-field border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent-text focus:border-transparent text-[15px] read-only:text-muted-strong"
              />
              <span id={id("excluded-chars-count")} className="mt-1 block text-sm text-muted">
                {formatPlural(lang, excludedCount, dict.excludedChars.count).replace("{count}", excludedCount.toString())}
              </span>
            </div>
            <p id={id("excluded-chars-help")} className="text-sm text-muted mt-2">
              {dict.excludedChars.help}
            </p>
            {excludedError && (
              <p id={id("excluded-chars-error")} role="alert" className="text-sm text-danger mt-1">{excludedError}</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: REGLES DU JEU */}
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
                  label={formatMinutes(dict.timeLimit.minutes, seconds)}
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

          {/* Capacités (CONFIG-9) : pas encore disponibles, l'interrupteur reste désactivé. */}
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-3 opacity-50">
              <div className="text-accent-text">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              </div>
              <div>
                <FieldHeading className="text-[15px] font-semibold">{dict.abilities.label}</FieldHeading>
                <p id={id("abilities-help")} className="text-sm text-muted mt-1">{dict.abilities.help}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
                {dict.abilities.comingSoon}
              </span>
              <Switch
                aria-label={dict.abilities.label}
                aria-describedby={id("abilities-help")}
                checked={false}
                onChange={() => {}}
                disabled
                className="opacity-50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ADVERSAIRES */}
      <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
            <Bot className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <SectionHeading className="text-xl font-bold text-foreground">{dict.opponentsSection.title}</SectionHeading>
            <p className="text-sm text-muted">{dict.opponentsSection.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-x-6 gap-y-2">
          <div>
            <FieldHeading className="text-[15px] font-semibold mb-3">{dict.botCount.label}</FieldHeading>
            <div className="flex items-center justify-between px-4 h-11 border border-border rounded-field mb-2">
              <button
                type="button"
                aria-label={dict.botCount.decrease}
                disabled={readOnly}
                onClick={() => onChange({ botCount: Math.max(0, value.botCount - 1) })}
                className="text-accent-text text-xl hover:opacity-80 disabled:opacity-40"
              >
                −
              </button>
              <span className="font-bold text-[15px]" aria-live="polite" aria-atomic="true">{value.botCount}</span>
              <button
                type="button"
                aria-label={dict.botCount.increase}
                disabled={readOnly}
                onClick={() => onChange({ botCount: Math.min(MAX_BOTS, value.botCount + 1) })}
                className="text-accent-text text-xl hover:opacity-80 disabled:opacity-40"
              >
                +
              </button>
            </div>
            <p className="text-xs text-muted">{dict.botCount.help}</p>
          </div>
          <div>
            <FieldHeading id={id("bot-difficulty-label")} className="text-[15px] font-semibold mb-3">{dict.botDifficulty.label}</FieldHeading>
            <div className="flex gap-3 mb-2" role="radiogroup" aria-labelledby={id("bot-difficulty-label")}>
              <RadioCard disabled={readOnly} checked={value.botDifficulty === "easy"} onChange={() => onChange({ botDifficulty: "easy" })} label={dict.botDifficulty.easy} className="justify-center text-center" />
              <RadioCard disabled={readOnly} checked={value.botDifficulty === "normal"} onChange={() => onChange({ botDifficulty: "normal" })} label={dict.botDifficulty.normal} className="justify-center text-center" />
              <RadioCard disabled={readOnly} checked={value.botDifficulty === "hard"} onChange={() => onChange({ botDifficulty: "hard" })} label={dict.botDifficulty.hard} className="justify-center text-center" />
            </div>
            <p className="text-xs text-muted">{dict.botDifficulty.help}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
