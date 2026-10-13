"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RaceSettingsFields } from "@/components/race/RaceSettingsFields";
import { Button } from "@/components/Button";
import { Settings2 } from "lucide-react";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";
import type { RaceSettings } from "@/race/config";
import { MAX_EXCLUDED_INPUT_LENGTH } from "@/realtime/protocol";
import type { TimeLimitSeconds } from "@/realtime/protocol";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { InviteFriendsButton } from "./InviteFriendsButton";
import { InviteFriendsUnavailable } from "./InviteFriendsUnavailable";

/** Qui regarde la page : décide si « Inviter des amis » est possible (SALLE-1, SALLE-12). */
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

/** Fills the localized "{minutes} min" template from a duration in seconds. */
function formatMinutes(template: string, seconds: TimeLimitSeconds): string {
  return template.replace("{minutes}", String(seconds / 60));
}

export function SettingsForm({ lang, dict, initialSettings, invite = { kind: "anonymous" } }: SettingsFormProps) {
  const router = useRouter();

  const [settings, setSettings] = useState<RaceSettings>({ ...(initialSettings ?? DEFAULT_RACE_SETTINGS) });
  const [excludedError, setExcludedError] = useState<string | null>(null);

  const handleChange = (patch: Partial<RaceSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.excludedCharacters !== undefined && excludedError) setExcludedError(null);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_RACE_SETTINGS });
    setExcludedError(null);
  };

  /** Même contrôle pour « Lancer la course » et « Inviter des amis ». */
  const validate = (): boolean => {
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
            />

            <p className="text-center text-sm text-muted mt-4">
              {dict.footer}
            </p>

          </div>

          {/* RIGHT COLUMN: RECAP CARD */}
          <aside className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-10">
            <div className="bg-surface border border-border rounded-[24px] overflow-hidden flex flex-col shadow-soft">
              {/* Illustration Header */}
              <div className="h-[180px] bg-island-mint relative overflow-hidden flex flex-col items-center justify-end">
                <div className="absolute top-6 left-6 text-left">
                  <h3 className="text-[22px] font-extrabold text-foreground">{dict.summary.title}</h3>
                </div>

                {/* Hills mockup */}
                <div className="absolute bottom-0 w-[120%] h-20 bg-key-mint/60 rounded-t-[100%] translate-y-4 -translate-x-10"></div>
                <div className="absolute bottom-0 w-[110%] h-16 bg-key-mint rounded-t-[100%] translate-y-2 translate-x-4"></div>
                <div className="absolute bottom-0 w-full h-4 bg-island-sand"></div>

                {/* Blobs mockup */}
                <div className="relative z-10 flex items-end gap-2 mb-4">
                   <div className="w-14 h-14 bg-accent-text rounded-t-full relative flex items-center justify-center">
                      <div className="flex gap-2 -mt-2">
                         <div className="w-2 h-2 bg-accent-foreground rounded-full"></div>
                         <div className="w-2 h-2 bg-accent-foreground rounded-full"></div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-8 pb-6 flex-1 flex flex-col">
                <p className="text-sm text-muted mb-6">
                  {dict.summary.participants.replace("{bots}", settings.botCount.toString()).replace("{total}", (settings.botCount + 1).toString())}
                </p>

                <ul className="flex flex-col gap-3 text-sm mb-8">
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.textMode.label}</span>
                    <span className="font-semibold">{settings.textMode === "sentences" ? dict.textMode.sentences : dict.textMode.words}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.language.label}</span>
                    <span className="font-semibold">{settings.language === "fr" ? dict.language.fr : dict.language.en}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.accents.label}</span>
                    <span className="font-semibold">{settings.accents ? dict.accents.include : dict.accents.exclude}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.length.label}</span>
                    <span className="font-semibold">{settings.length === "short" ? dict.length.short : settings.length === "medium" ? dict.length.medium : dict.length.long}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.excludedChars.label}</span>
                    <span className="font-semibold">{settings.excludedCharacters || dict.excludedChars.none}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.timeLimit.label}</span>
                    <span className="font-semibold">{settings.timeLimitSeconds === null ? dict.timeLimit.noneShort : formatMinutes(dict.timeLimit.minutes, settings.timeLimitSeconds)}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.inputMode.label}</span>
                    <span className="font-semibold">{settings.inputMode === "free" ? dict.inputMode.free : dict.inputMode.blocking}</span>
                  </li>
                  <li className="flex justify-between border-b border-border pb-3">
                    <span className="text-muted">{dict.botCount.label}</span>
                    <span className="font-semibold">{settings.botCount} · {settings.botDifficulty === "easy" ? dict.botDifficulty.easy : settings.botDifficulty === "normal" ? dict.botDifficulty.normal : dict.botDifficulty.hard}</span>
                  </li>
                  <li className="flex justify-between pb-1">
                    <span className="text-muted">{dict.abilities.label}</span>
                    <span className="font-semibold">{dict.abilities.off}</span>
                  </li>
                </ul>

                <div className="bg-accent-soft rounded-[12px] p-4 flex gap-3 mb-6">
                  <div className="text-accent-text mt-0.5">
                     <Settings2 className="w-5 h-5" />
                  </div>
                  <p className="text-[13px] text-accent-text font-medium leading-relaxed">
                    {dict.summary.tip}
                  </p>
                </div>

                <Button fullWidth className="text-[15px] mt-auto" onClick={handleLaunch}>
                  {dict.summary.start} <span className="ml-1">→</span>
                </Button>
                <p className="text-center text-xs text-muted mt-4">
                  {dict.summary.ready}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {invite.kind === "member" ? (
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
                  )}
                </div>
              </div>
            </div>
          </aside>

        </div>
    </main>
  );
}
