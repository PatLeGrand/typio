"use client";

import { useId } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import { RaceOpponentSettings } from "./RaceOpponentSettings";
import { RaceRoomSettings } from "./RaceRoomSettings";
import { RaceRulesSettings } from "./RaceRulesSettings";
import { RaceTextSettings } from "./RaceTextSettings";

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
  onIncludedBlur?: () => void;
  /** Le champ des caractères exclus perd le focus (la salle envoie alors son patch). */
  onExcludedBlur?: () => void;
  /** Niveau des titres de section : 2 sur la page de paramètres, 3 sous le titre de la salle. */
  headingLevel?: 2 | 3;
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
  includedError = null,
  onIncludedBlur,
  onExcludedBlur,
  headingLevel = 2,
}: RaceSettingsFieldsProps) {
  const uid = useId();

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
        includedError={includedError}
        excludedError={excludedError}
        onIncludedBlur={onIncludedBlur}
        onExcludedBlur={onExcludedBlur}
      />
      <RaceRulesSettings value={value} onChange={onChange} readOnly={readOnly} dict={dict} lang={lang} idPrefix={uid} headingLevel={headingLevel} />
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
      <RaceRoomSettings value={value} onChange={onChange} readOnly={readOnly} dict={dict} lang={lang} idPrefix={uid} headingLevel={headingLevel} />
    </div>
  );
}
