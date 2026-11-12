import { Bot, Plus, X } from "lucide-react";
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
  const FieldHeading = headingLevel === 3 ? "h4" : "h3";
  const id = (name: string) => `${idPrefix}-${name}`;
  const numberFormat = new Intl.NumberFormat(lang);

  return (
    <section className="bg-surface border border-border rounded-[24px] p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-text flex items-center justify-center">
          <Bot className="w-6 h-6" aria-hidden="true" />
        </div>
        <div>
          <SectionHeading className="text-xl font-bold text-foreground">{dict.opponentsSection.title}</SectionHeading>
          <p className="text-sm text-muted">{dict.opponentsSection.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <FieldHeading className="text-[15px] font-semibold">{dict.bots.label}</FieldHeading>
          <span aria-live="polite" aria-atomic="true" className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold tabular-nums text-accent-text">
            {numberFormat.format(value.bots.length)} / {numberFormat.format(MAX_BOTS)}
          </span>
        </div>
        {value.bots.length === 0 && <p className="text-sm text-muted">{dict.bots.empty}</p>}
        {value.bots.map((level, index) => (
          <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_44px]">
            <span className="text-sm font-semibold sm:row-start-1">{dict.bots.name.replace("{number}", numberFormat.format(index + 1))}</span>
            <label htmlFor={id(`bot-${index}`)} className="sr-only">{dict.bots.level.replace("{number}", numberFormat.format(index + 1))}</label>
            <select
              id={id(`bot-${index}`)}
              aria-describedby={id(`bot-${index}-speed`)}
              value={level}
              disabled={readOnly}
              className="col-start-1 row-start-2 h-11 w-full min-w-0 rounded-field border border-border bg-surface px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:text-muted sm:col-start-2 sm:row-start-1"
              onChange={(event) => onChange({ bots: value.bots.map((current, i) => i === index ? event.target.value as BotLevel : current) })}
            >
              {BOT_LEVELS.map((option) => <option key={option} value={option}>{dict.bots.levels[option]}</option>)}
            </select>
            <span id={id(`bot-${index}-speed`)} className="col-start-1 text-sm tabular-nums text-muted sm:col-start-3 sm:row-start-1">
              {dict.bots.speed.replace("{min}", numberFormat.format(BOT_LEVEL_PROFILES[level].minWpm)).replace("{max}", numberFormat.format(BOT_LEVEL_PROFILES[level].maxWpm))}
            </span>
            <button type="button" disabled={readOnly} aria-label={dict.bots.remove.replace("{number}", numberFormat.format(index + 1))} className="col-start-2 row-start-1 row-span-3 inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-50 sm:col-start-4 sm:row-span-1" onClick={() => onChange({ bots: value.bots.filter((_, i) => i !== index) })}>
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        ))}
        <Button variant="secondary" disabled={readOnly || value.bots.length >= MAX_BOTS || runnerCount + value.bots.length >= value.capacity} fullWidth className="border-dashed" onClick={() => onChange({ bots: [...value.bots, "intermediate"] })}>
          <Plus aria-hidden="true" className="size-5 shrink-0" />
          {dict.bots.add}
        </Button>
      </div>
    </section>
  );
}
