import { Plus, X } from "lucide-react";
import { Button } from "@/components/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { RaceSettings } from "@/race/config";
import { BOT_LEVEL_PROFILES } from "@/race/bots";
import { BOT_LEVELS, MAX_BOTS } from "@/realtime/protocol";
import type { BotLevel } from "@/realtime/protocol";

type RaceOpponentSettingsProps = {
  value: RaceSettings;
  onChange: (patch: Partial<RaceSettings>) => void;
  readOnly: boolean;
  dict: Dictionary["raceSettings"];
  lang: string;
  /** Préfixe d'identifiants issu du `useId` de `RaceSettingsFields`. */
  idPrefix: string;
  headingLevel: 2 | 3;
  runnerCount: number;
};

/** Section « adversaires » des réglages de course (BOT-01). */
export function RaceOpponentSettings({ value, onChange, readOnly, dict, lang, idPrefix, headingLevel, runnerCount }: RaceOpponentSettingsProps) {
  const SectionHeading = headingLevel === 3 ? "h3" : "h2";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);

  return (
    <section className="flex flex-col gap-4 border-t border-border/80 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading
            className={headingLevel === 3 ? "text-base font-bold text-foreground" : "font-display text-[1.65rem] font-black leading-none tracking-[-0.01em] text-foreground"}
          >
            {dict.opponentsSection.title}
          </SectionHeading>
          <p className="mt-1 text-sm text-muted">{dict.opponentsSection.subtitle}</p>
        </div>
        <span aria-live="polite" aria-atomic="true" className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tabular-nums text-accent-text">
          {numberFormat.format(value.bots.length)} / {numberFormat.format(MAX_BOTS)}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {value.bots.length === 0 ? <p className="text-sm text-muted">{dict.bots.empty}</p> : null}
        {value.bots.map((level, index) => (
          <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-center gap-x-3 gap-y-2 rounded-field border border-border bg-surface px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_44px]">
            <span className="text-sm font-semibold text-foreground sm:row-start-1">{dict.bots.name.replace("{number}", numberFormat.format(index + 1))}</span>
            <label htmlFor={id(`bot-${index}`)} className="sr-only">{dict.bots.level.replace("{number}", numberFormat.format(index + 1))}</label>
            <select
              id={id(`bot-${index}`)}
              aria-describedby={id(`bot-${index}-speed`)}
              value={level}
              disabled={readOnly}
              className="col-start-1 row-start-2 h-11 w-full min-w-0 rounded-field border border-border bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:text-muted sm:col-start-2 sm:row-start-1"
              onChange={(event) => onChange({ bots: value.bots.map((current, i) => i === index ? event.target.value as BotLevel : current) })}
            >
              {BOT_LEVELS.map((option) => <option key={option} value={option}>{dict.bots.levels[option]}</option>)}
            </select>
            <span id={id(`bot-${index}-speed`)} className="col-start-1 text-xs font-medium tabular-nums text-muted sm:col-start-3 sm:row-start-1">
              {dict.bots.speed.replace("{min}", numberFormat.format(BOT_LEVEL_PROFILES[level].minWpm)).replace("{max}", numberFormat.format(BOT_LEVEL_PROFILES[level].maxWpm))}
            </span>
            <button type="button" disabled={readOnly} aria-label={dict.bots.remove.replace("{number}", numberFormat.format(index + 1))} className="col-start-2 row-start-1 row-span-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50 sm:col-start-4 sm:row-span-1" onClick={() => onChange({ bots: value.bots.filter((_, i) => i !== index) })}>
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="secondary" disabled={readOnly || value.bots.length >= MAX_BOTS || runnerCount + value.bots.length >= value.capacity} fullWidth className="border-dashed" onClick={() => onChange({ bots: [...value.bots, "intermediate"] })}>
          <Plus aria-hidden="true" className="size-4 shrink-0" />
          {dict.bots.add}
        </Button>
      </div>
    </section>
  );
}
