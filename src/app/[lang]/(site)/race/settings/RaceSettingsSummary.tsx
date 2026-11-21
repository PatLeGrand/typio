import { useId, type RefObject } from "react";
import { Button } from "@/components/Button";
import type { RaceSettings } from "@/race/config";
import { formatPlural } from "@/race/format";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type RaceSettingsSummaryProps = {
  settings: RaceSettings;
  dict: Dictionary["raceSettings"];
  lang: Locale;
  onLaunch: () => void;
  /** Repère du bouton de lancement d'origine pour déclencher le bouton flottant sur ordinateur. */
  launchButtonRef?: RefObject<HTMLDivElement | null>;
};

/**
 * Résumé en une phrase et lancement dans l'esprit « stade de nuit » (`--screen*`).
 * Sous `lg`, barre compacte (≤ 72 px) collée en bas de l'écran pour lancer sans parcourir la page.
 */
export function RaceSettingsSummary({ settings, dict, lang, onLaunch, launchButtonRef }: RaceSettingsSummaryProps) {
  const headingId = useId();
  const numberFormat = new Intl.NumberFormat(lang);

  const timeLimitLabel = settings.timeLimitSeconds === null
    ? dict.summary.noTimeLimit
    : settings.timeLimitSeconds < 60
      ? dict.timeLimit.seconds.replace("{seconds}", numberFormat.format(settings.timeLimitSeconds))
      : dict.timeLimit.minutes.replace("{minutes}", numberFormat.format(settings.timeLimitSeconds / 60));

  const botsLabel = settings.bots.length === 0
    ? dict.summary.solo
    : formatPlural(lang, settings.bots.length, dict.summary.botsCount).replace("{count}", numberFormat.format(settings.bots.length));

  const summaryParts = [
    settings.textMode === "sentences" ? dict.textMode.sentences : dict.textMode.words,
    settings.language === "fr" ? dict.language.fr : dict.language.en,
    dict.complexity[settings.complexity],
    dict.length.words.replace("{count}", numberFormat.format(settings.length)),
    timeLimitLabel,
    botsLabel,
  ];

  return (
    <aside
      aria-labelledby={headingId}
      className="sticky bottom-0 z-20 -mx-4 border-t border-screen-border bg-screen text-screen-text shadow-[0_-8px_24px_rgba(0,0,0,0.22)] sm:-mx-8 lg:relative lg:bottom-auto lg:col-start-2 lg:row-start-1 lg:mx-0 lg:overflow-hidden lg:rounded-panel lg:border-t-0 lg:shadow-soft lg:ring-1 lg:ring-inset lg:ring-screen-border"
    >
      {/* Lignes de virage discrètes du stade de nuit */}
      <svg
        aria-hidden="true"
        viewBox="0 0 380 340"
        fill="none"
        preserveAspectRatio="xMaxYMin slice"
        className="pointer-events-none absolute inset-0 hidden size-full lg:block"
      >
        <path d="M270 -20C270 86 322 142 396 142" stroke="var(--screen-border)" strokeWidth="1.5" opacity="0.9" />
        <path d="M226 -20C226 112 292 184 396 184" stroke="var(--screen-border)" strokeWidth="1.5" opacity="0.55" />
      </svg>

      {/* Filet tartan sur la barre mobile collée en bas */}
      <div aria-hidden="true" className="track-surface relative h-1 w-full lg:hidden">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_10px,transparent_10px_20px)] opacity-75" />
      </div>

      <div className="relative z-10 flex items-center gap-3 px-4 pb-2.5 pt-1.5 sm:px-8 lg:flex-col lg:items-stretch lg:gap-5 lg:px-7 lg:pb-8 lg:pt-7">
        <div className="sr-only sm:not-sr-only sm:min-w-0 sm:flex-1 lg:flex lg:flex-none lg:flex-col lg:gap-3">
          <h2
            id={headingId}
            className="sr-only text-balance font-display text-3xl font-black leading-[0.92] tracking-[-0.01em] text-screen-text lg:not-sr-only"
          >
            {dict.summary.title}
          </h2>
          <p className="text-xs font-medium leading-relaxed text-screen-text max-lg:truncate sm:text-sm lg:rounded-2xl lg:border lg:border-screen-border lg:bg-screen-surface lg:px-4 lg:py-3.5">
            {/* Sur grand écran, chaque segment porte son « · » devant lui ; la rangée est décalée de
                la largeur d'un séparateur dans un conteneur rogné, si bien que le « · » d'un segment
                qui ouvre une ligne sort du cadre au lieu de commencer la ligne. */}
            <span className="lg:block lg:overflow-hidden">
              <span className="lg:-ml-4 lg:flex lg:flex-wrap lg:items-baseline lg:gap-y-0.5">
                {summaryParts.map((part, index) => (
                  <span key={index} className="inline whitespace-nowrap lg:inline-flex lg:items-baseline">
                    <span
                      aria-hidden="true"
                      className={`text-key-yellow lg:inline-block lg:w-4 lg:text-center ${index === 0 ? "hidden" : "mx-1.5 lg:mx-0"}`}
                    >
                      ·
                    </span>
                    <span className={index === 0 ? "font-semibold" : undefined}>{part}</span>
                  </span>
                ))}
              </span>
            </span>
          </p>
        </div>

        <div ref={launchButtonRef} className="w-full shrink-0 sm:w-auto lg:w-full">
          <Button
            variant="start"
            onClick={onLaunch}
            className="w-full max-lg:min-h-11 max-lg:py-2"
          >
            {dict.summary.start}
          </Button>
        </div>

        <p className="hidden text-center text-xs leading-relaxed text-screen-muted lg:block">
          {dict.summary.ready}
        </p>

        <p className="hidden border-t border-screen-border pt-4 text-xs leading-relaxed text-screen-muted lg:block">
          {dict.summary.tip}
        </p>
      </div>

      {/* Bande de piste tartan avec damier d'arrivée sur grand écran */}
      <div
        aria-hidden="true"
        className="track-surface pointer-events-none relative hidden h-3 border-t border-track-line/35 lg:block"
      >
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--track-line)_0_12px,transparent_12px_24px)] opacity-75" />
        <span className="track-checker absolute inset-y-0 right-0 w-3.5 opacity-90" />
      </div>
    </aside>
  );
}
