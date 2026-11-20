import { Flame, Gauge, Layers, Timer } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { formatPlural } from "@/race/format";
import type {
  BreakdownBucket,
  ConsistencySummary,
  PersonalStatsTotals,
  StreakSummary,
} from "@/race/personalStats";

type Props = {
  breakdowns: {
    byTextMode: BreakdownBucket<"sentences" | "words">[];
    byLanguage: BreakdownBucket<"fr" | "en">[];
    byComplexity: BreakdownBucket<"easy" | "medium" | "hard">[];
    byFormat: BreakdownBucket<"solo" | "multiplayer">[];
  };
  totals: PersonalStatsTotals;
  errorCostWpm: number | null;
  consistency: ConsistencySummary | null;
  streaks: StreakSummary;
  locale: Locale;
  labels: Dictionary["stats"]["breakdowns"];
  disciplineLabels: Dictionary["stats"]["discipline"];
  noValue: string;
};

function formatTotalTime(
  ms: number,
  number: Intl.NumberFormat,
  labels: Dictionary["stats"]["discipline"],
): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return labels.durationHoursMinutes
      .replace("{hours}", number.format(hours))
      .replace("{minutes}", number.format(minutes));
  }
  if (minutes > 0) {
    return labels.durationMinutesSeconds
      .replace("{minutes}", number.format(minutes))
      .replace("{seconds}", number.format(seconds));
  }
  return labels.durationSeconds.replace("{seconds}", number.format(seconds));
}

function BreakdownGroup<K extends string>({
  title,
  buckets,
  bucketLabels,
  locale,
  labels,
  noValue,
}: {
  title: string;
  buckets: readonly BreakdownBucket<K>[];
  bucketLabels: Record<K, string>;
  locale: Locale;
  labels: Dictionary["stats"]["breakdowns"];
  noValue: string;
}) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const totalRaces = buckets.reduce((sum, b) => sum + b.raceCount, 0);
  const maxWpm = Math.max(0, ...buckets.map((b) => b.averageWpm ?? 0));

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h3>
      <ul className="flex flex-col gap-2">
        {buckets.map((bucket) => {
          const share = totalRaces > 0 ? Math.round((bucket.raceCount / totalRaces) * 100) : 0;
          const isFastest =
            maxWpm > 0 &&
            bucket.averageWpm !== null &&
            bucket.averageWpm === maxWpm &&
            buckets.filter((b) => b.eligibleCount > 0).length > 1;
          const countLabel = formatPlural(locale, bucket.raceCount, labels.racesCount).replace(
            "{count}",
            integer.format(bucket.raceCount),
          );

          return (
            <li
              key={bucket.key}
              className="rounded-field border border-border bg-background px-3.5 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{bucketLabels[bucket.key]}</span>
                  {isFastest && (
                    <span className="rounded-full bg-key-mint px-2 py-0.5 text-[11px] font-bold text-key-ink">
                      {labels.fastest}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3 text-sm tabular-nums">
                  <span className="font-bold text-accent-text">
                    {bucket.averageWpm === null
                      ? noValue
                      : labels.wpmValue.replace("{wpm}", number.format(bucket.averageWpm))}
                  </span>
                  <span className="text-xs text-muted">
                    {bucket.averageAccuracy === null ? noValue : percent.format(bucket.averageAccuracy / 100)}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${bucket.raceCount > 0 ? Math.max(4, share) : 0}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted">{countLabel}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StatsBreakdowns({
  breakdowns,
  totals,
  errorCostWpm,
  consistency,
  streaks,
  locale,
  labels,
  disciplineLabels,
  noValue,
}: Props) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* Analyse par terrain */}
      <section
        aria-labelledby="stats-breakdowns-title"
        className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6"
      >
        <div className="border-b border-border pb-4">
          <h2
            id="stats-breakdowns-title"
            className="flex items-center gap-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl"
          >
            <Layers aria-hidden="true" className="size-6 shrink-0 text-accent-text" />
            <span>{labels.title}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <BreakdownGroup
            title={labels.byTextMode}
            buckets={breakdowns.byTextMode}
            bucketLabels={labels.modes}
            locale={locale}
            labels={labels}
            noValue={noValue}
          />
          <BreakdownGroup
            title={labels.byLanguage}
            buckets={breakdowns.byLanguage}
            bucketLabels={labels.languages}
            locale={locale}
            labels={labels}
            noValue={noValue}
          />
          <BreakdownGroup
            title={labels.byFormat}
            buckets={breakdowns.byFormat}
            bucketLabels={labels.formats}
            locale={locale}
            labels={labels}
            noValue={noValue}
          />
          <BreakdownGroup
            title={labels.byComplexity}
            buckets={breakdowns.byComplexity}
            bucketLabels={labels.complexities}
            locale={locale}
            labels={labels}
            noValue={noValue}
          />
        </div>
      </section>

      {/* Régularité, coût des fautes, séries & endurance */}
      <section
        aria-labelledby="stats-discipline-title"
        className="flex min-w-0 flex-col justify-between gap-5 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6"
      >
        <div className="border-b border-border pb-4">
          <h2
            id="stats-discipline-title"
            className="flex items-center gap-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl"
          >
            <Gauge aria-hidden="true" className="size-6 shrink-0 text-accent-text" />
            <span>{disciplineLabels.title}</span>
          </h2>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          {/* Coût des fautes (Brut vs Net) */}
          <div className="rounded-field border border-border bg-island-sand p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {disciplineLabels.errorCostTitle}
            </h3>
            <p className="mt-1 font-display text-3xl font-black tabular-nums text-foreground">
              {errorCostWpm === null
                ? noValue
                : disciplineLabels.errorCostValue.replace("{wpm}", number.format(errorCostWpm))}
            </p>
            {totals.averageWpm !== null && totals.averageGrossWpm !== null && (
              <p className="mt-1 text-xs text-muted">
                {disciplineLabels.errorCostHint
                  .replace("{gross}", number.format(totals.averageGrossWpm))
                  .replace("{net}", number.format(totals.averageWpm))}
              </p>
            )}
          </div>

          {/* Régularité */}
          <div className="rounded-field border border-border bg-island-mint p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {disciplineLabels.consistencyTitle}
            </h3>
            {consistency ? (
              <>
                <p className="mt-1 font-display text-3xl font-black text-foreground">
                  {disciplineLabels.consistencyLevels[consistency.level]}
                </p>
                <p className="mt-1 text-xs tabular-nums text-muted">
                  {disciplineLabels.consistencyStdDev.replace("{value}", number.format(consistency.stdDev))}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">{disciplineLabels.consistencyNeedMore}</p>
            )}
          </div>

          {/* Séries et temps sur la piste */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-field border border-border bg-background p-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Flame aria-hidden="true" className="size-3.5 text-accent-text" />
                <span>{disciplineLabels.winStreakTitle}</span>
              </dt>
              <dd className="mt-1 font-display text-3xl font-black tabular-nums text-foreground">
                {integer.format(streaks.currentWinStreak)}
              </dd>
              <dd className="text-xs tabular-nums text-muted">
                {disciplineLabels.winStreakBest.replace("{count}", integer.format(streaks.bestWinStreak))}
              </dd>
            </div>

            <div className="rounded-field border border-border bg-background p-3">
              <dt className="text-xs font-semibold text-muted">{disciplineLabels.finishStreakTitle}</dt>
              <dd className="mt-1 font-display text-3xl font-black tabular-nums text-foreground">
                {integer.format(streaks.currentFinishStreak)}
              </dd>
              <dd className="text-xs tabular-nums text-muted">
                {disciplineLabels.finishStreakBest.replace("{count}", integer.format(streaks.bestFinishStreak))}
              </dd>
            </div>

            <div className="rounded-field border border-border bg-background p-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Timer aria-hidden="true" className="size-3.5 text-accent-text" />
                <span>{disciplineLabels.timeTypedTitle}</span>
              </dt>
              <dd className="mt-1 font-display text-2xl font-black tabular-nums text-foreground">
                {formatTotalTime(totals.totalDurationMs, integer, disciplineLabels)}
              </dd>
              <dd className="text-xs tabular-nums text-muted">
                {formatPlural(locale, totals.totalErrors, disciplineLabels.totalErrorsHint).replace(
                  "{count}",
                  integer.format(totals.totalErrors),
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
