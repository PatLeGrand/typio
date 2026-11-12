import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/Button";
import type { RaceSettings } from "@/race/config";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type RaceSettingsSummaryProps = {
  settings: RaceSettings;
  dict: Dictionary["raceSettings"];
  lang: Locale;
  onLaunch: () => void;
  /** Bouton « Inviter des amis » ou message d'indisponibilité, selon qui regarde la page. */
  inviteAction: ReactNode;
};

/** Récapitulatif illustré des réglages, avec les actions de lancement et d'invitation. */
export function RaceSettingsSummary({ settings, dict, lang, onLaunch, inviteAction }: RaceSettingsSummaryProps) {
  const numberFormat = new Intl.NumberFormat(lang);

  return (
  <aside className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-10">
    <div className="bg-surface border border-border rounded-[24px] overflow-hidden flex flex-col shadow-soft">
      {/* Illustration Header */}
      <div className="h-[180px] bg-island-mint relative overflow-hidden flex flex-col items-center justify-end">
        <div className="absolute top-6 left-6 text-left">
          <h2 className="text-[22px] font-extrabold text-foreground">{dict.summary.title}</h2>
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
          {dict.summary.participants.replace("{bots}", settings.bots.length.toString()).replace("{total}", (settings.bots.length + 1).toString())}
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
            <span className="text-muted">{dict.complexity.label}</span>
            <span className="font-semibold">{dict.complexity[settings.complexity]}</span>
          </li>
          {(["punctuation", "numbers", "uppercase"] as const).map((option) => (
            <li key={option} className="flex justify-between border-b border-border pb-3">
              <span className="text-muted">{dict[option].label}</span>
              <span className="font-semibold">{settings[option] ? dict.accents.include : dict.accents.exclude}</span>
            </li>
          ))}
          <li className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">{dict.length.label}</span>
            <span className="font-semibold">{dict.length.words.replace("{count}", numberFormat.format(settings.length))}</span>
          </li>
          <li className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">{dict.excludedChars.label}</span>
            <span className="font-semibold">{settings.excludedCharacters || dict.excludedChars.none}</span>
          </li>
          <li className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">{dict.timeLimit.label}</span>
            <span className="font-semibold">{settings.timeLimitSeconds === null ? dict.timeLimit.noneShort : settings.timeLimitSeconds < 60 ? dict.timeLimit.seconds.replace("{seconds}", numberFormat.format(settings.timeLimitSeconds)) : dict.timeLimit.minutes.replace("{minutes}", numberFormat.format(settings.timeLimitSeconds / 60))}</span>
          </li>
          <li className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">{dict.inputMode.label}</span>
            <span className="font-semibold">{settings.inputMode === "free" ? dict.inputMode.free : dict.inputMode.blocking}</span>
          </li>
          <li className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">{dict.bots.label}</span>
            <span className="font-semibold">{settings.bots.length} · {settings.bots.map((level) => dict.bots.levels[level]).join(", ")}</span>
          </li>
          <li className="flex justify-between pb-1">
            <span className="text-muted">{dict.bonuses.label}</span>
            <span className="font-semibold">{settings.bonuses ? dict.bonuses.on : dict.bonuses.off}</span>
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

        <Button variant="start" fullWidth className="mt-auto" onClick={onLaunch}>
          {dict.summary.start}
        </Button>
        <p className="text-center text-xs text-muted mt-4">
          {dict.summary.ready}
        </p>
        <div className="mt-6 border-t border-border pt-6 flex flex-col gap-3">
          <h3 className="text-balance text-lg font-semibold text-foreground">{dict.invite.title}</h3>
          <p className="text-sm text-muted-strong">{dict.invite.description}</p>
          {inviteAction}
        </div>
      </div>
    </div>
  </aside>
  );
}
