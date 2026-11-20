"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { DEFAULT_RACE_SETTINGS, type RaceSettings } from "@/race/config";
import { formatPlural } from "@/race/format";
import { RaceOpponentSettings } from "./RaceOpponentSettings";
import { RaceRoomSettings } from "./RaceRoomSettings";
import { RaceAdvancedRulesSettings, RaceRulesSettings } from "./RaceRulesSettings";
import { RaceAdvancedTextSettings, RaceTextSettings } from "./RaceTextSettings";

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
  includedError?: string | null;
  /** Incrémenté sur chaque tentative de validation échouée pour rouvrir et replacer le focus. */
  errorTrigger?: number;
  onIncludedBlur?: () => void;
  /** Le champ des caractères exclus perd le focus (la salle envoie alors son patch). */
  onExcludedBlur?: () => void;
  /** Niveau des titres de section : 2 sur la page de paramètres, 3 sous le titre de la salle. */
  headingLevel?: 2 | 3;
  /** Affiche la section « La salle » ici (vrai en salle d'attente, faux sur la page de paramètres où elle est déplacée). */
  showRoomSettings?: boolean;
}

/** Compte combien des options avancées diffèrent des valeurs par défaut (badge « N modifiés »). */
export function countModifiedAdvancedSettings(settings: RaceSettings): number {
  let count = 0;
  if (settings.accents !== DEFAULT_RACE_SETTINGS.accents) count += 1;
  if (settings.punctuation !== DEFAULT_RACE_SETTINGS.punctuation) count += 1;
  if (settings.numbers !== DEFAULT_RACE_SETTINGS.numbers) count += 1;
  if (settings.uppercase !== DEFAULT_RACE_SETTINGS.uppercase) count += 1;
  if (settings.textMode === "words" && settings.includedCharacters !== DEFAULT_RACE_SETTINGS.includedCharacters) count += 1;
  if (settings.excludedCharacters !== DEFAULT_RACE_SETTINGS.excludedCharacters) count += 1;
  if (settings.inputMode !== DEFAULT_RACE_SETTINGS.inputMode) count += 1;
  if (settings.bonuses !== DEFAULT_RACE_SETTINGS.bonuses) count += 1;
  return count;
}

/**
 * Réglages de course (CONF-01 à CONF-10, BOT-01) : essentiel visible et « Plus d'options » replié,
 * partagés entre la page de paramètres (état local) et la salle d'attente (lecture seule hors hôte).
 */
export function RaceSettingsFields({
  value,
  onChange,
  readOnly = false,
  runnerCount = 1,
  dict,
  lang,
  excludedError = null,
  includedError = null,
  errorTrigger = 0,
  onIncludedBlur,
  onExcludedBlur,
  headingLevel = 2,
  showRoomSettings = true,
}: RaceSettingsFieldsProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const includedInputRef = useRef<HTMLInputElement>(null);
  const excludedInputRef = useRef<HTMLInputElement>(null);

  const hasAdvancedError = Boolean(includedError || excludedError);
  const errorKey = `${includedError ?? ""}|${excludedError ?? ""}|${errorTrigger}`;
  const [lastErrorKey, setLastErrorKey] = useState(errorKey);
  const [advancedOpen, setAdvancedOpen] = useState(hasAdvancedError);

  if (errorKey !== lastErrorKey) {
    setLastErrorKey(errorKey);
    if (hasAdvancedError) setAdvancedOpen(true);
  }

  useEffect(() => {
    if (includedError) includedInputRef.current?.focus();
    else if (excludedError) excludedInputRef.current?.focus();
  }, [includedError, excludedError, errorTrigger]);

  const modifiedCount = countModifiedAdvancedSettings(value);
  const numberFormat = new Intl.NumberFormat(lang);
  const modifiedLabel = modifiedCount > 0
    ? formatPlural(lang, modifiedCount, dict.advanced.modified).replace("{count}", numberFormat.format(modifiedCount))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <RaceTextSettings
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        dict={dict}
        lang={lang}
        idPrefix={uid}
        headingLevel={headingLevel}
      />
      <RaceRulesSettings
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        dict={dict}
        lang={lang}
        idPrefix={uid}
        headingLevel={headingLevel}
      />
      <RaceOpponentSettings
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        dict={dict}
        lang={lang}
        idPrefix={uid}
        headingLevel={headingLevel}
        runnerCount={runnerCount}
      />

      {/* Bloc « Plus d'options » replié par défaut, ouvert automatiquement en cas d'erreur */}
      <section className="border-t border-border/80 pt-6">
        <SectionHeading className="m-0">
          <button
            id={id("advanced-toggle")}
            type="button"
            aria-expanded={advancedOpen}
            aria-controls={id("advanced-panel")}
            aria-describedby={advancedOpen ? undefined : id("advanced-hint")}
            onClick={() => setAdvancedOpen((open) => !open)}
            className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-field py-1 text-left transition-colors"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={
                  headingLevel === 3
                    ? "text-base font-bold text-foreground transition-colors group-hover:text-accent-text"
                    : "font-display text-[1.65rem] font-black leading-none tracking-[-0.01em] text-foreground transition-colors group-hover:text-accent-text"
                }
              >
                {dict.advanced.title}
              </span>
              {modifiedLabel ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-accent-text">
                  {" "}{modifiedLabel}
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`size-5 shrink-0 text-muted transition-transform duration-150 group-hover:text-accent-text motion-reduce:transition-none ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
        </SectionHeading>
        {advancedOpen ? null : (
          <p id={id("advanced-hint")} className="mt-1 text-sm text-muted">
            {dict.advanced.hint}
          </p>
        )}

        {advancedOpen ? (
          <div
            id={id("advanced-panel")}
            role="region"
            aria-labelledby={id("advanced-toggle")}
            className="mt-5 flex flex-col gap-6 pt-1"
          >
            <RaceAdvancedTextSettings
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              dict={dict}
              lang={lang}
              idPrefix={uid}
              headingLevel={headingLevel}
              includedError={includedError}
              excludedError={excludedError}
              onIncludedBlur={onIncludedBlur}
              onExcludedBlur={onExcludedBlur}
              includedInputRef={includedInputRef}
              excludedInputRef={excludedInputRef}
            />
            <div className="border-t border-border/70 pt-5">
              <RaceAdvancedRulesSettings
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                dict={dict}
                idPrefix={uid}
                headingLevel={headingLevel}
              />
            </div>
          </div>
        ) : null}
      </section>

      {showRoomSettings ? (
        <RaceRoomSettings
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          dict={dict}
          lang={lang}
          idPrefix={uid}
          headingLevel={headingLevel}
        />
      ) : null}
    </div>
  );
}
