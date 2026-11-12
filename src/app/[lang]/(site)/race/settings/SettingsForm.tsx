"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RaceSettingsFields } from "@/components/race/RaceSettingsFields";
import { Button } from "@/components/Button";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";
import type { RaceSettings } from "@/race/config";
import { MAX_EXCLUDED_INPUT_LENGTH } from "@/realtime/protocol";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { RaceSettingsSummary } from "./RaceSettingsSummary";
import { InviteFriendsButton } from "./InviteFriendsButton";
import { InviteFriendsUnavailable } from "./InviteFriendsUnavailable";

/** Qui regarde la page : décide si « Inviter des amis » est possible (SALLE-01, AUTH-03). */
export type InviteAccess =
  | { kind: "member"; userId: string; roomErrors: Dictionary["room"]["errors"] }
  | { kind: "guest" }
  | { kind: "anonymous" };

interface SettingsFormProps {
  lang: Locale;
  dict: Dictionary["raceSettings"];
  /** Réglages de départ (retour depuis une course) ; les réglages par défaut si absents. */
  initialSettings?: RaceSettings;
  /** Par défaut anonyme : aucune connexion à la salle n'est ouverte. */
  invite?: InviteAccess;
}

export function SettingsForm({ lang, dict, initialSettings, invite = { kind: "anonymous" } }: SettingsFormProps) {
  const router = useRouter();

  const [settings, setSettings] = useState<RaceSettings>({ ...(initialSettings ?? DEFAULT_RACE_SETTINGS) });
  const [includedError, setIncludedError] = useState<string | null>(null);
  const [excludedError, setExcludedError] = useState<string | null>(null);

  const handleChange = (patch: Partial<RaceSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.includedCharacters !== undefined) setIncludedError(null);
    if (patch.excludedCharacters !== undefined && excludedError) setExcludedError(null);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_RACE_SETTINGS });
    setIncludedError(null);
    setExcludedError(null);
  };

  /** Même contrôle pour « Lancer la course » et « Inviter des amis ». */
  const validate = (): boolean => {
    if (settings.includedCharacters.length > MAX_EXCLUDED_INPUT_LENGTH) {
      setIncludedError(dict.includedChars.error);
      return false;
    }
    setIncludedError(null);
    if (settings.excludedCharacters.length > MAX_EXCLUDED_INPUT_LENGTH) {
      setExcludedError(dict.excludedChars.error);
      return false;
    }
    setExcludedError(null);
    return true;
  };

  const handleLaunch = () => {
    if (!validate()) return;
    router.push(`/${lang}/race?${serializeRaceSettings(settings)}`);
  };

  const inviteAction =
    invite.kind === "member" ? (
      <InviteFriendsButton
        lang={lang}
        userId={invite.userId}
        settings={settings}
        validate={validate}
        labels={dict.invite}
        errorMessages={invite.roomErrors}
      />
    ) : (
      <InviteFriendsUnavailable kind={invite.kind} lang={lang} labels={dict.invite} />
    );

  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 text-foreground sm:px-8">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row gap-4 items-start justify-between mb-8">
          <div>
            <h1 className="text-[40px] font-extrabold text-foreground leading-tight tracking-tight mb-2">
              {dict.title}
            </h1>
            <p className="text-muted text-lg">
              {dict.subtitle}
            </p>
          </div>
          <Button variant="secondary" className="bg-surface" onClick={handleReset}>
            {dict.reset}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* LEFT COLUMN: SETTINGS */}
          <div className="min-w-0 w-full flex-1 flex flex-col gap-6">

            <RaceSettingsFields
              value={settings}
              onChange={handleChange}
              dict={dict}
              lang={lang}
              excludedError={excludedError}
              includedError={includedError}
            />

            <p className="text-center text-sm text-muted mt-4">
              {dict.footer}
            </p>

          </div>

          {/* RIGHT COLUMN: RECAP CARD */}
          <RaceSettingsSummary settings={settings} dict={dict} lang={lang} onLaunch={handleLaunch} inviteAction={inviteAction} />

        </div>
    </main>
  );
}
