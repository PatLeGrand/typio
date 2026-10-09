"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/Card";
import { RaceSettingsFields } from "@/components/race/RaceSettingsFields";
import { toRaceSettings, toRoomConfigPatch } from "@/components/race/roomSettings";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import { MAX_EXCLUDED_INPUT_LENGTH, type RoomConfig, type RoomConfigPatch } from "@/realtime/protocol";

/** Pause de frappe après laquelle le champ des caractères exclus envoie son patch (B-D5). */
export const EXCLUDED_SEND_DELAY_MS = 500;

type RoomConfigPanelProps = {
  config: RoomConfig;
  /** Vrai pour l'hôte : réglages modifiables. Sinon, lecture seule (SALLE-10). */
  editable: boolean;
  lang: string;
  labels: Dictionary["room"]["config"];
  settingsLabels: Dictionary["raceSettings"];
  /** Envoie le patch au serveur ; la promesse se résout quand il a répondu (accepté ou refusé). */
  onChange: (patch: RoomConfigPatch) => Promise<unknown>;
};

/**
 * Configuration de la salle (CONFIG-1 à 8) : les mêmes sections que la page de paramètres, modifiables
 * pour l'hôte, en lecture seule pour les autres. L'état affiché est celui de la salle : un patch refusé
 * ne change rien. Seul le champ des caractères exclus garde un brouillon, envoyé à la sortie du champ
 * ou après une pause de frappe.
 */
export function RoomConfigPanel({ config, editable, lang, labels, settingsLabels, onChange }: RoomConfigPanelProps) {
  // Brouillon du champ des caractères exclus ; `null` : on affiche la valeur (normalisée) de la salle.
  const [draft, setDraft] = useState<string | null>(null);
  const [excludedError, setExcludedError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typing = useRef(false);
  const unsent = useRef(false);
  const latestDraft = useRef("");
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function sendDraft(): void {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (!unsent.current) return;
    if (latestDraft.current.length > MAX_EXCLUDED_INPUT_LENGTH) {
      setExcludedError(settingsLabels.excludedChars.error);
      return;
    }
    unsent.current = false;
    void onChangeRef.current({ excludedCharacters: latestDraft.current }).then(() => {
      // Fin de la saisie et rien de plus récent à envoyer : retour à la valeur de la salle.
      if (!typing.current && !unsent.current) setDraft(null);
    });
  }

  function handleExcludedBlur(): void {
    typing.current = false;
    if (unsent.current) sendDraft();
    else if (!excludedError) setDraft(null);
  }

  function handleChange(patch: Partial<RaceSettings>): void {
    if (patch.excludedCharacters !== undefined) {
      typing.current = true;
      unsent.current = true;
      latestDraft.current = patch.excludedCharacters;
      setDraft(patch.excludedCharacters);
      setExcludedError(null);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(sendDraft, EXCLUDED_SEND_DELAY_MS);
      return;
    }
    void onChange(toRoomConfigPatch(patch));
  }

  const value = toRaceSettings(config);
  const shown: RaceSettings = draft === null ? value : { ...value, excludedCharacters: draft };

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 className="text-lg font-bold text-foreground">{labels.title}</h2>
      <RaceSettingsFields
        value={shown}
        onChange={handleChange}
        readOnly={!editable}
        dict={settingsLabels}
        lang={lang}
        excludedError={excludedError}
        onExcludedBlur={editable ? handleExcludedBlur : undefined}
      />
      {editable ? null : <p className="text-sm text-muted-strong">{labels.hostOnly}</p>}
    </Card>
  );
}
