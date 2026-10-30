"use client";

import { useId } from "react";
import { Bot, DoorOpen, SlidersHorizontal, Type } from "lucide-react";
import { SelectField } from "@/components/SelectField";
import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlural } from "@/race/format";
import type { RaceSettings } from "@/race/config";
import { BOT_LEVEL_PROFILES } from "@/race/bots";
import { BOT_LEVELS, MAX_BOTS, MAX_CAPACITY, MIN_CAPACITY, ROOM_VISIBILITIES, TEXT_COMPLEXITIES, TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import type { BotLevel, RoomVisibility, TimeLimitSeconds } from "@/realtime/protocol";

interface RaceSettingsFieldsProps {
  value: RaceSettings;
  /** Reçoit uniquement les clés modifiées par le contrôle manipulé. */
  onChange: (patch: Partial<RaceSettings>) => void;
  /** Mêmes sections et mêmes valeurs, contrôles inactifs (non-hôte d'une salle, CONF-12). */
  readOnly?: boolean;
  runnerCount?: number;
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
 * Les trois sections de réglages de course (CONF-01 à CONF-10, BOT-01), contrôlées par `value`. Partagées par la
 * page de paramètres (état local) et la salle d'attente (état de la salle, lecture seule hors hôte).
 */
export function RaceSettingsFields({
  value,
  onChange,
  readOnly = false,
  runnerCount = 1,
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

  const numberFormat = new Intl.NumberFormat(lang);
  const capacityOptions = Array.from({ length: MAX_CAPACITY - MIN_CAPACITY + 1 }, (_, index) => {
    const capacity = MIN_CAPACITY + index;
    return { value: String(capacity), label: numberFormat.format(capacity) };
  });

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

          {/* Complexité (CONF-05) */}
          <div className="sm:col-span-2">
            <FieldHeading id={id("complexity-label")} className="text-[15px] font-semibold mb-3">{dict.complexity.label}</FieldHeading>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby={id("complexity-label")}>
              {TEXT_COMPLEXITIES.map((complexity) => (
                <RadioCard
                  key={complexity}
                  disabled={readOnly}
                  checked={value.complexity === complexity}
                  onChange={() => onChange({ complexity })}
                  label={dict.complexity[complexity]}
                  description={dict.complexity.descriptions[complexity]}
                />
              ))}
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

          {/* Options du texte (CONF-06) */}
          <div className="flex flex-col gap-4">
            {(["punctuation", "numbers", "uppercase"] as const).map((option) => (
              <div key={option} className="flex items-center justify-between gap-3">
                <span id={id(`${option}-label`)} className="text-[15px] font-semibold">{dict[option].label}</span>
                <Switch
                  aria-labelledby={id(`${option}-label`)}
                  disabled={readOnly}
                  checked={value[option]}
                  onChange={(checked) => onChange({ [option]: checked })}
                />
              </div>
            ))}
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

          {/* Capacités (CONF-09) : pas encore disponibles, l'interrupteur reste désactivé. */}
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

        <div className="flex flex-col gap-3">
          <FieldHeading className="text-[15px] font-semibold">{dict.bots.label}</FieldHeading>
          <span aria-live="polite" aria-atomic="true">{numberFormat.format(value.bots.length)}</span>
          {value.bots.map((level, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3">
              <SelectField
                label={dict.bots.level.replace("{number}", numberFormat.format(index + 1))}
                value={level}
                disabled={readOnly}
                options={BOT_LEVELS.map((level) => ({ value: level, label: dict.bots.levels[level] }))}
                onChange={(event) => onChange({ bots: value.bots.map((current, i) => i === index ? event.target.value as BotLevel : current) })}
              />
              <button type="button" disabled={readOnly} className="text-accent-text disabled:opacity-40" onClick={() => onChange({ bots: value.bots.filter((_, i) => i !== index) })}>
                {dict.bots.remove.replace("{number}", numberFormat.format(index + 1))}
              </button>
            </div>
          ))}
          <button type="button" disabled={readOnly || value.bots.length >= MAX_BOTS || runnerCount + value.bots.length >= value.capacity} className="self-start text-accent-text disabled:opacity-40" onClick={() => onChange({ bots: [...value.bots, "intermediate"] })}>
            {dict.bots.add}
          </button>
          <p className="text-xs text-muted">{BOT_LEVELS.map((level) => dict.bots.help.replace("{level}", dict.bots.levels[level]).replace("{min}", numberFormat.format(BOT_LEVEL_PROFILES[level].minWpm)).replace("{max}", numberFormat.format(BOT_LEVEL_PROFILES[level].maxWpm))).join(" · ")}</p>
        </div>
      </section>

      {/* SECTION 4: SALLE (SALLE-03, SALLE-05) */}
      <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
            <DoorOpen className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <SectionHeading className="text-xl font-bold text-foreground">{dict.roomSection.title}</SectionHeading>
            <p className="text-sm text-muted">{dict.roomSection.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <div className="flex flex-col gap-2">
            <SelectField
              label={dict.visibility.label}
              value={value.visibility}
              disabled={readOnly}
              options={ROOM_VISIBILITIES.map((visibility) => ({ value: visibility, label: dict.visibility[visibility] }))}
              onChange={(event) => onChange({ visibility: event.target.value as RoomVisibility })}
              aria-describedby={id("visibility-help")}
            />
            <p id={id("visibility-help")} className="text-xs text-muted">{dict.visibility.help}</p>
          </div>
          <div className="flex flex-col gap-2">
            <SelectField
              label={dict.capacity.label}
              value={String(value.capacity)}
              disabled={readOnly}
              options={capacityOptions}
              onChange={(event) => onChange({ capacity: Number(event.target.value) })}
              aria-describedby={id("capacity-help")}
            />
            <p id={id("capacity-help")} className="text-xs text-muted">{dict.capacity.help}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
