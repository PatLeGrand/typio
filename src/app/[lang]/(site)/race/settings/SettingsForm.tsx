"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { RaceRoomSettings } from "@/components/race/RaceRoomSettings";
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
  /** Classe portant `--font-big-shoulders` (fournie par `page.tsx` via `next/font`). */
  displayFontClassName?: string;
}

export function SettingsForm({
  lang,
  dict,
  initialSettings,
  invite = { kind: "anonymous" },
  displayFontClassName = "",
}: SettingsFormProps) {
  const router = useRouter();
  const inviteHeadingId = useId();
  const roomIdPrefix = useId();

  const [settings, setSettings] = useState<RaceSettings>({ ...(initialSettings ?? DEFAULT_RACE_SETTINGS) });
  const [includedError, setIncludedError] = useState<string | null>(null);
  const [excludedError, setExcludedError] = useState<string | null>(null);
  const [errorTrigger, setErrorTrigger] = useState(0);
  const launchButtonRef = useRef<HTMLDivElement>(null);
  const [showFloatingLaunch, setShowFloatingLaunch] = useState(false);

  // Marge de défilement basse sous `lg` pour qu'aucun contrôle focalisé ne soit masqué par la barre collée (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-race-settings-dock", "");
    return () => root.removeAttribute("data-race-settings-dock");
  }, []);

  // Sur ordinateur, affiche un bouton « Lancer la course » flottant quand celui du résumé sort par le haut (DES-06).
  useEffect(() => {
    const target = launchButtonRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const topLimit = entry.rootBounds?.top ?? 0;
        setShowFloatingLaunch(!entry.isIntersecting && entry.boundingClientRect.bottom <= topLimit);
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
      setErrorTrigger((count) => count + 1);
      return false;
    }
    setIncludedError(null);
    if (settings.excludedCharacters.length > MAX_EXCLUDED_INPUT_LENGTH) {
      setExcludedError(dict.excludedChars.error);
      setErrorTrigger((count) => count + 1);
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
    <main className={`${displayFontClassName} mx-auto w-full max-w-[1200px] flex-1 overflow-x-clip px-4 pb-10 pt-6 text-foreground sm:px-8 sm:pt-10`}>
      {/* En-tête de page dans le vocabulaire « stade » */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-col items-start gap-2.5">
          <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            <span aria-hidden="true" className="h-0.5 w-6 bg-track-accent" />
            {dict.kicker}
          </p>
          <h1 className="text-balance font-display text-[clamp(2.5rem,8vw,3.75rem)] font-black leading-[0.9] tracking-[-0.01em] text-foreground">
            {dict.title}
          </h1>
          <p className="max-w-[54ch] text-pretty text-[15px] leading-relaxed text-muted">
            {dict.subtitle}
          </p>
        </div>
        <Button variant="secondary" className="shrink-0 bg-surface" onClick={handleReset}>
          <RotateCcw aria-hidden="true" className="size-4 shrink-0" />
          {dict.reset}
        </Button>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr_auto] lg:items-start lg:gap-x-10 lg:gap-y-5">
        {/* Colonne de gauche : réglages essentiels + « Plus d'options » */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <RaceSettingsFields
            value={settings}
            onChange={handleChange}
            dict={dict}
            lang={lang}
            excludedError={excludedError}
            includedError={includedError}
            errorTrigger={errorTrigger}
            showRoomSettings={false}
          />
        </div>

        {/* Bloc « Avec des amis » : juste après « Plus d'options » sous lg, colonne de droite sur lg+ */}
        <section
          aria-labelledby={inviteHeadingId}
          className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-soft sm:p-6 lg:col-start-2 lg:row-start-2"
        >
          <div className="flex flex-col gap-1">
            <h2
              id={inviteHeadingId}
              className="text-balance font-display text-2xl font-black leading-none tracking-[-0.01em] text-foreground"
            >
              {dict.invite.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-strong">{dict.invite.description}</p>
          </div>
          {invite.kind === "member" ? (
            <div className="border-t border-border/80 pt-4">
              <RaceRoomSettings
                value={settings}
                onChange={handleChange}
                readOnly={false}
                dict={dict}
                lang={lang}
                idPrefix={roomIdPrefix}
                headingLevel={3}
                compact
              />
            </div>
          ) : null}
          <div className={`flex flex-col gap-3 ${invite.kind === "member" ? "border-t border-border/80 pt-4" : ""}`}>
            {inviteAction}
          </div>
        </section>

        <p className="text-xs leading-relaxed text-muted lg:col-start-1 lg:row-start-3">
          {dict.footer}
        </p>

        {/* Panneau « stade de nuit » : résumé en une phrase + lancement (barre collée en bas sous lg) */}
        <RaceSettingsSummary
          settings={settings}
          dict={dict}
          lang={lang}
          onLaunch={handleLaunch}
          launchButtonRef={launchButtonRef}
        />
      </div>

      {/* Bouton de lancement flottant sur ordinateur quand celui du résumé sort de l'écran (DES-06) */}
      <div
        aria-hidden={!showFloatingLaunch}
        inert={!showFloatingLaunch}
        className="pointer-events-none hidden lg:sticky lg:bottom-24 lg:z-30 lg:block lg:h-0"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-x-10">
          <div className="col-start-2 -mx-2 -translate-y-full overflow-hidden px-2 pb-3 pt-2">
            <div
              className={`transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none ${
                showFloatingLaunch ? "pointer-events-auto visible translate-y-0" : "pointer-events-none invisible translate-y-[150%]"
              }`}
            >
              <Button
                variant="start"
                fullWidth
                tabIndex={showFloatingLaunch ? undefined : -1}
                onClick={handleLaunch}
              >
                {dict.summary.start}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
