import { Type } from "lucide-react";
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
  includedError: string | null;
  excludedError: string | null;
  onIncludedBlur?: () => void;
  onExcludedBlur?: () => void;
};

/** Section « texte à taper » des réglages de course (CONF-01 à CONF-06). */
export function RaceTextSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel, includedError, excludedError, onIncludedBlur, onExcludedBlur }: RaceTextSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);
  const excludedCount = new Set(Array.from(value.excludedCharacters).filter((character) => !/\s/u.test(character))).size;

  return (
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
          <SelectField
            label={dict.length.label}
            value={String(value.length)}
            disabled={readOnly}
            options={TEXT_WORD_COUNTS.map((count) => ({ value: String(count), label: dict.length.words.replace("{count}", numberFormat.format(count)) }))}
            onChange={(event) => onChange({ length: Number(event.target.value) as TextLength })}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={id("included-chars")} className="block text-[15px] font-semibold mb-3">{dict.includedChars.label}</label>
          <input
            id={id("included-chars")}
            type="text"
            value={value.includedCharacters}
            readOnly={readOnly}
            disabled={value.textMode === "sentences"}
            aria-invalid={Boolean(includedError)}
            aria-describedby={`${id("included-chars-help")}${includedError ? ` ${id("included-chars-error")}` : ""}`}
            onChange={(event) => onChange({ includedCharacters: event.target.value })}
            onBlur={onIncludedBlur}
            className="w-full h-12 px-4 rounded-field border border-border bg-background disabled:opacity-40"
          />
          <p id={id("included-chars-help")} className="text-sm text-muted mt-2">
            {value.textMode === "sentences" ? dict.includedChars.sentencesHelp : dict.includedChars.help}
          </p>
          {includedError && <p id={id("included-chars-error")} role="alert" className="text-sm text-danger mt-1">{includedError}</p>}
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
              {formatPlural(lang, excludedCount, dict.excludedChars.count).replace("{count}", numberFormat.format(excludedCount))}
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
  );
}
