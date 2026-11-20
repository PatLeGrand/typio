import type { RefObject } from "react";
import { SelectField } from "@/components/SelectField";
import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlural } from "@/race/format";
import type { RaceSettings } from "@/race/config";
import { TEXT_COMPLEXITIES, TEXT_WORD_COUNTS } from "@/realtime/protocol";
import type { TextLength } from "@/realtime/protocol";

type RaceTextSettingsProps = {
  value: RaceSettings;
  onChange: (patch: Partial<RaceSettings>) => void;
  readOnly: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  /** Préfixe d'identifiants issu du `useId` de `RaceSettingsFields`. */
  idPrefix: string;
  headingLevel: 2 | 3;
};

/** Réglages essentiels de la section « texte à taper » (CONF-01 à CONF-05). */
export function RaceTextSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel }: RaceTextSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);

  return (
    <section className="flex flex-col gap-5">
      <div>
        <SectionHeading
          className={headingLevel === 3 ? "text-base font-bold text-foreground" : "font-display text-[1.65rem] font-black leading-none tracking-[-0.01em] text-foreground"}
        >
          {dict.textSection.title}
        </SectionHeading>
        <p className="mt-1 text-sm text-muted">{dict.textSection.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {/* Type de texte */}
        <div>
          <FieldHeading id={id("text-mode-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.textMode.label}</FieldHeading>
          <div className="flex gap-2.5" role="radiogroup" aria-labelledby={id("text-mode-label")}>
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
          <FieldHeading id={id("language-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.language.label}</FieldHeading>
          <div className="flex gap-2.5" role="radiogroup" aria-labelledby={id("language-label")}>
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

        {/* Complexité (CONF-05) : description affichée uniquement pour l'option choisie */}
        <div className="sm:col-span-2">
          <FieldHeading id={id("complexity-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.complexity.label}</FieldHeading>
          <div
            className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3"
            role="radiogroup"
            aria-labelledby={id("complexity-label")}
            aria-describedby={id("complexity-help")}
          >
            {TEXT_COMPLEXITIES.map((complexity) => (
              <RadioCard
                key={complexity}
                disabled={readOnly}
                checked={value.complexity === complexity}
                onChange={() => onChange({ complexity })}
                label={dict.complexity[complexity]}
              />
            ))}
          </div>
          <p id={id("complexity-help")} className="mt-2 text-xs leading-relaxed text-muted">
            {dict.complexity.descriptions[value.complexity]}
          </p>
        </div>

        {/* Longueur */}
        <div>
          <SelectField
            label={dict.length.label}
            value={String(value.length)}
            disabled={readOnly}
            options={TEXT_WORD_COUNTS.map((count) => ({ value: String(count), label: dict.length.words.replace("{count}", numberFormat.format(count)) }))}
            onChange={(event) => onChange({ length: Number(event.target.value) as TextLength })}
          />
        </div>
      </div>
    </section>
  );
}

type RaceAdvancedTextSettingsProps = {
  value: RaceSettings;
  onChange: (patch: Partial<RaceSettings>) => void;
  readOnly: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  idPrefix: string;
  headingLevel: 2 | 3;
  includedError: string | null;
  excludedError: string | null;
  onIncludedBlur?: () => void;
  onExcludedBlur?: () => void;
  includedInputRef?: RefObject<HTMLInputElement | null>;
  excludedInputRef?: RefObject<HTMLInputElement | null>;
};

/** Options avancées du texte (CONF-03, CONF-06) : accents, casse/nombres/ponctuation, filtres de caractères. */
export function RaceAdvancedTextSettings({
  value,
  onChange,
  readOnly,
  dict,
  lang,
  idPrefix,
  headingLevel,
  includedError,
  excludedError,
  onIncludedBlur,
  onExcludedBlur,
  includedInputRef,
  excludedInputRef,
}: RaceAdvancedTextSettingsProps) {
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);
  const excludedCount = new Set(Array.from(value.excludedCharacters).filter((character) => !/\s/u.test(character))).size;
  const showIncludedChars = value.textMode === "words" || Boolean(includedError);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      {/* Accents */}
      <div>
        <FieldHeading id={id("accents-label")} className="mb-2 text-sm font-semibold text-foreground">{dict.accents.label}</FieldHeading>
        <div className="flex gap-2.5" role="radiogroup" aria-labelledby={id("accents-label")}>
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
      <div className="flex flex-col justify-center gap-3">
        {(["punctuation", "numbers", "uppercase"] as const).map((option) => (
          <div key={option} className="flex items-center justify-between gap-3">
            <span id={id(`${option}-label`)} className="text-sm font-semibold text-foreground">{dict[option].label}</span>
            <Switch
              aria-labelledby={id(`${option}-label`)}
              disabled={readOnly}
              checked={value[option]}
              onChange={(checked) => onChange({ [option]: checked })}
            />
          </div>
        ))}
      </div>

      {/* Caractères à inclure : visible seulement en mode Mots (ou si une erreur de validation existe) */}
      {showIncludedChars ? (
        <div className="sm:col-span-2">
          <label htmlFor={id("included-chars")} className="mb-2 block text-sm font-semibold text-foreground">
            {dict.includedChars.label}
          </label>
          <input
            ref={includedInputRef}
            id={id("included-chars")}
            type="text"
            value={value.includedCharacters}
            readOnly={readOnly}
            aria-invalid={Boolean(includedError)}
            aria-describedby={`${id("included-chars-help")}${includedError ? ` ${id("included-chars-error")}` : ""}`}
            onChange={(event) => onChange({ includedCharacters: event.target.value })}
            onBlur={onIncludedBlur}
            className={`h-11 w-full scroll-mb-36 rounded-field border bg-surface px-field text-[15px] text-foreground read-only:text-muted-strong lg:scroll-mb-0 ${
              includedError ? "border-danger" : "border-border"
            }`}
          />
          <p id={id("included-chars-help")} className="mt-1.5 text-xs leading-relaxed text-muted">
            {value.textMode === "sentences" ? dict.includedChars.sentencesHelp : dict.includedChars.help}
          </p>
          {includedError ? (
            <p id={id("included-chars-error")} role="alert" className="mt-1 text-xs font-medium text-danger">
              {includedError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Caractères exclus */}
      <div className="sm:col-span-2">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <label htmlFor={id("excluded-chars")} className="text-sm font-semibold text-foreground">
            {dict.excludedChars.label}
          </label>
          <span id={id("excluded-chars-count")} className="text-xs font-medium tabular-nums text-muted">
            {formatPlural(lang, excludedCount, dict.excludedChars.count).replace("{count}", numberFormat.format(excludedCount))}
          </span>
        </div>
        <input
          ref={excludedInputRef}
          id={id("excluded-chars")}
          type="text"
          aria-invalid={Boolean(excludedError)}
          aria-describedby={`${id("excluded-chars-count")} ${id("excluded-chars-help")}${excludedError ? ` ${id("excluded-chars-error")}` : ""}`}
          value={value.excludedCharacters}
          readOnly={readOnly}
          onChange={(event) => onChange({ excludedCharacters: event.target.value })}
          onBlur={onExcludedBlur}
          placeholder={readOnly ? undefined : dict.excludedChars.placeholder}
          className={`h-11 w-full scroll-mb-36 rounded-field border bg-surface px-field text-[15px] text-foreground read-only:text-muted-strong lg:scroll-mb-0 ${
            excludedError ? "border-danger" : "border-border"
          }`}
        />
        <p id={id("excluded-chars-help")} className="mt-1.5 text-xs leading-relaxed text-muted">
          {dict.excludedChars.help}
        </p>
        {excludedError ? (
          <p id={id("excluded-chars-error")} role="alert" className="mt-1 text-xs font-medium text-danger">
            {excludedError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
