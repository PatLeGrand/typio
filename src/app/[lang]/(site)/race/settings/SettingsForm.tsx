"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RadioCard } from "@/components/race/RadioCard";
import { Switch } from "@/components/race/Switch";
import { Button } from "@/components/Button";
import { Settings2, Type, SlidersHorizontal, Bot } from "lucide-react";
import { DEFAULT_RACE_SETTINGS, serializeRaceSettings } from "@/race/config";
import type { RaceSettings } from "@/race/config";
import { TIME_LIMITS_SECONDS } from "@/realtime/protocol";
import type { TimeLimitSeconds } from "@/realtime/protocol";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatPlural } from "@/race/format";

interface SettingsFormProps {
  lang: string;
  dict: Dictionary["raceSettings"];
  /** Réglages de départ (retour depuis une course) ; les réglages par défaut si absents. */
  initialSettings?: RaceSettings;
}

/** Fills the localized "{minutes} min" template from a duration in seconds. */
function formatMinutes(template: string, seconds: TimeLimitSeconds): string {
  return template.replace("{minutes}", String(seconds / 60));
}

export function SettingsForm({ lang, dict, initialSettings }: SettingsFormProps) {
  const router = useRouter();

  const [settings, setSettings] = useState<RaceSettings>({ ...(initialSettings ?? DEFAULT_RACE_SETTINGS) });
  const [excludedError, setExcludedError] = useState<string | null>(null);

  const handleReset = () => {
    setSettings({ ...DEFAULT_RACE_SETTINGS });
    setExcludedError(null);
  };

  const excludedCount = new Set(Array.from(settings.excludedCharacters).filter((character) => !/\s/u.test(character))).size;

  const handleLaunch = () => {
    if (settings.excludedCharacters.length > 100) {
      setExcludedError(dict.excludedChars.error);
      return;
    }
    setExcludedError(null);

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

            {/* SECTION 1: TEXTE A TAPER */}
            <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
                  <Type className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{dict.textSection.title}</h2>
                  <p className="text-sm text-muted">{dict.textSection.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                {/* Type de texte */}
                <div>
                  <h3 id="text-mode-label" className="text-[15px] font-semibold mb-3">{dict.textMode.label}</h3>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="text-mode-label">
                    <RadioCard
                      checked={settings.textMode === "sentences"}
                      onChange={() => setSettings({ ...settings, textMode: "sentences" })}
                      label={dict.textMode.sentences}
                    />
                    <RadioCard
                      checked={settings.textMode === "words"}
                      onChange={() => setSettings({ ...settings, textMode: "words" })}
                      label={dict.textMode.words}
                    />
                  </div>
                </div>

                {/* Langue */}
                <div>
                  <h3 id="language-label" className="text-[15px] font-semibold mb-3">{dict.language.label}</h3>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="language-label">
                    <RadioCard
                      checked={settings.language === "fr"}
                      onChange={() => setSettings({ ...settings, language: "fr" })}
                      label={dict.language.fr}
                    />
                    <RadioCard
                      checked={settings.language === "en"}
                      onChange={() => setSettings({ ...settings, language: "en" })}
                      label={dict.language.en}
                    />
                  </div>
                </div>

                {/* Accents */}
                <div>
                  <h3 id="accents-label" className="text-[15px] font-semibold mb-3">{dict.accents.label}</h3>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="accents-label">
                    <RadioCard
                      checked={settings.accents === true}
                      onChange={() => setSettings({ ...settings, accents: true })}
                      label={dict.accents.include}
                    />
                    <RadioCard
                      checked={settings.accents === false}
                      onChange={() => setSettings({ ...settings, accents: false })}
                      label={dict.accents.exclude}
                    />
                  </div>
                </div>

                {/* Longueur */}
                <div>
                  <h3 id="length-label" className="text-[15px] font-semibold mb-3">{dict.length.label}</h3>
                  <div className="flex gap-3" role="radiogroup" aria-labelledby="length-label">
                    <RadioCard
                      checked={settings.length === "short"}
                      onChange={() => setSettings({ ...settings, length: "short" })}
                      label={dict.length.short}
                    />
                    <RadioCard
                      checked={settings.length === "medium"}
                      onChange={() => setSettings({ ...settings, length: "medium" })}
                      label={dict.length.medium}
                    />
                    <RadioCard
                      checked={settings.length === "long"}
                      onChange={() => setSettings({ ...settings, length: "long" })}
                      label={dict.length.long}
                    />
                  </div>
                </div>

                {/* Excluded Chars */}
                <div className="sm:col-span-2">
                  <h3 className="text-[15px] font-semibold mb-3">{dict.excludedChars.label}</h3>
                  <div className="relative">
                    <input
                      type="text" aria-label={dict.excludedChars.label} aria-invalid={Boolean(excludedError)}
                      aria-describedby={`excluded-chars-count excluded-chars-help${excludedError ? " excluded-chars-error" : ""}`}
                      value={settings.excludedCharacters}
                      onChange={(e) => {
                        setSettings({ ...settings, excludedCharacters: e.target.value });
                        if (excludedError) setExcludedError(null);
                      }}
                      placeholder={dict.excludedChars.placeholder}
                      className="w-full h-12 px-4 rounded-field border border-border bg-background focus:outline-none focus:ring-2 focus:ring-accent-text focus:border-transparent text-[15px]"
                    />
                    <span id="excluded-chars-count" className="mt-1 block text-sm text-muted">
                      {formatPlural(lang, excludedCount, dict.excludedChars.count).replace("{count}", excludedCount.toString())}
                    </span>
                  </div>
                  <p id="excluded-chars-help" className="text-sm text-muted mt-2">
                    {dict.excludedChars.help}
                  </p>
                  {excludedError && (
                    <p id="excluded-chars-error" role="alert" className="text-sm text-danger mt-1">{excludedError}</p>
                  )}
                </div>
              </div>
            </section>

            {/* SECTION 2: REGLES DU JEU */}
            <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{dict.rulesSection.title}</h2>
                  <p className="text-sm text-muted">{dict.rulesSection.subtitle}</p>
                </div>
              </div>

              <div className="flex flex-col gap-8">
                {/* Limite de temps */}
                <fieldset className="border-b border-border pb-8">
                  <legend id="time-limit-label" className="text-[15px] font-semibold">{dict.timeLimit.label}</legend>
                  <p id="time-limit-help" className="text-sm text-muted mt-1 mb-3">{dict.timeLimit.help}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="time-limit-label" aria-describedby="time-limit-help">
                    <RadioCard
                      checked={settings.timeLimitSeconds === null}
                      onChange={() => setSettings({ ...settings, timeLimitSeconds: null })}
                      label={dict.timeLimit.none}
                      className="justify-center text-center"
                    />
                    {TIME_LIMITS_SECONDS.map((seconds) => (
                      <RadioCard
                        key={seconds}
                        checked={settings.timeLimitSeconds === seconds}
                        onChange={() => setSettings({ ...settings, timeLimitSeconds: seconds })}
                        label={formatMinutes(dict.timeLimit.minutes, seconds)}
                        className="justify-center text-center"
                      />
                    ))}
                  </div>
                </fieldset>

                {/* Mode de saisie */}
                <div>
                  <h3 id="input-mode-label" className="text-[15px] font-semibold mb-3">{dict.inputMode.label}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" role="radiogroup" aria-labelledby="input-mode-label">
                    <RadioCard
                      layout="vertical"
                      checked={settings.inputMode === "free"}
                      onChange={() => setSettings({ ...settings, inputMode: "free" })}
                      label={dict.inputMode.free}
                      description={dict.inputMode.freeDesc}
                    />
                    <RadioCard
                      layout="vertical"
                      checked={settings.inputMode === "blocking"}
                      onChange={() => setSettings({ ...settings, inputMode: "blocking" })}
                      label={dict.inputMode.blocking}
                      description={dict.inputMode.blockingDesc}
                    />
                  </div>
                </div>

                {/* Capacités */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="text-accent-text">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold">{dict.abilities.label}</h3>
                      <p id="abilities-help" className="text-sm text-muted mt-1">{dict.abilities.help}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-semibold text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
                      {dict.abilities.comingSoon}
                    </span>
                    <Switch aria-label={dict.abilities.label} aria-describedby="abilities-help" checked={false} onChange={() => {}} disabled className="opacity-50" />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: ADVERSAIRES */}
            <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">{dict.opponentsSection.title}</h2>
                  <p className="text-sm text-muted">{dict.opponentsSection.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-x-6 gap-y-2">
                <div>
                  <h3 className="text-[15px] font-semibold mb-3">{dict.botCount.label}</h3>
                  <div className="flex items-center justify-between px-4 h-11 border border-border rounded-field mb-2">
                    <button aria-label={dict.botCount.decrease} onClick={() => setSettings({ ...settings, botCount: Math.max(0, settings.botCount - 1) })} className="text-accent-text text-xl hover:opacity-80">−</button>
                    <span className="font-bold text-[15px]" aria-live="polite" aria-atomic="true">{settings.botCount}</span>
                    <button aria-label={dict.botCount.increase} onClick={() => setSettings({ ...settings, botCount: Math.min(7, settings.botCount + 1) })} className="text-accent-text text-xl hover:opacity-80">+</button>
                  </div>
                  <p className="text-xs text-muted">{dict.botCount.help}</p>
                </div>
                <div>
                  <h3 id="bot-difficulty-label" className="text-[15px] font-semibold mb-3">{dict.botDifficulty.label}</h3>
                  <div className="flex gap-3 mb-2" role="radiogroup" aria-labelledby="bot-difficulty-label">
                    <RadioCard checked={settings.botDifficulty === "easy"} onChange={() => setSettings({ ...settings, botDifficulty: "easy" })} label={dict.botDifficulty.easy} className="justify-center text-center" />
                    <RadioCard checked={settings.botDifficulty === "normal"} onChange={() => setSettings({ ...settings, botDifficulty: "normal" })} label={dict.botDifficulty.normal} className="justify-center text-center" />
                    <RadioCard checked={settings.botDifficulty === "hard"} onChange={() => setSettings({ ...settings, botDifficulty: "hard" })} label={dict.botDifficulty.hard} className="justify-center text-center" />
                  </div>
                  <p className="text-xs text-muted">{dict.botDifficulty.help}</p>
                </div>
              </div>
            </section>

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
              </div>
            </div>
          </aside>

        </div>
    </main>
  );
}
