"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { SelectField } from "@/components/SelectField";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { TEXT_LANGUAGES, type LobbyRoom, type TextLanguage } from "@/realtime/protocol";

type RoomExplorerProps = {
  locale: Locale;
  labels: Dictionary["room"]["play"]["explorer"];
  /** `null` : la liste n'est pas encore arrivée. */
  rooms: LobbyRoom[] | null;
  disabled: boolean;
  /** Rejoint en coureur, sans saisir le code. */
  onJoin: (code: string) => void;
};

/**
 * Explorateur de salles publiques (JOIN-02), mis à jour par le serveur sans rechargement. Filtre par
 * langue côté client ; la complexité (CONF-05) n'existe pas encore et n'est donc pas affichée.
 */
export function RoomExplorer({ locale, labels, rooms, disabled, onJoin }: RoomExplorerProps) {
  const [language, setLanguage] = useState<TextLanguage | "all">("all");
  const numbers = new Intl.NumberFormat(locale);
  const shown = rooms?.filter((room) => language === "all" || room.language === language) ?? [];

  return (
    <Card className="flex flex-col gap-4 border border-border p-6">
      <h2 id="explorer-title" className="text-xl font-bold text-foreground">{labels.title}</h2>
      <p className="text-muted-strong">{labels.description}</p>
      <SelectField
        label={labels.filterLanguage}
        value={language}
        onChange={(event) => setLanguage(event.target.value === "all" ? "all" : (event.target.value as TextLanguage))}
        options={[
          { value: "all", label: labels.allLanguages },
          ...TEXT_LANGUAGES.map((value) => ({ value, label: labels.languages[value] })),
        ]}
      />
      {rooms === null ? (
        <p aria-live="polite" className="text-muted-strong">{labels.loading}</p>
      ) : shown.length === 0 ? (
        <p aria-live="polite" className="text-muted-strong">{labels.empty}</p>
      ) : (
        <ul aria-labelledby="explorer-title" className="flex flex-col gap-2">
          {shown.map((room) => (
            <li
              key={room.code}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-field border border-border px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {labels.host.replace("{name}", room.host)}
                </span>
                <span className="text-sm text-muted-strong">
                  {labels.runners
                    .replace("{count}", numbers.format(room.runners))
                    .replace("{max}", numbers.format(room.capacity))}
                  {" · "}
                  {labels.languages[room.language]}
                  {" · "}
                  {labels.status[room.status]}
                </span>
              </div>
              {room.joinable ? (
                <Button variant="secondary" disabled={disabled} onClick={() => onJoin(room.code)}>
                  {labels.join}
                </Button>
              ) : (
                <span className="text-sm font-semibold text-muted-strong">
                  {room.runners >= room.capacity ? labels.full : labels.unavailable}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
