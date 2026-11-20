import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, Trophy } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { prefixWithLocale } from "@/i18n/paths";
import type { BestRaceSummary, PersonalStatsTotals, TrendSummary } from "@/race/personalStats";

type Props = {
  totals: PersonalStatsTotals;
  bestRace: BestRaceSummary | null;
  trend: TrendSummary | null;
  locale: Locale;
  labels: Dictionary["stats"]["board"];
  noValue: string;
};

export function StatsTimingBoard({ totals, bestRace, trend, locale, labels, noValue }: Props) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const percentWhole = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const completionRatio = totals.raceCount > 0 ? totals.finishedCount / totals.raceCount : 0;
  const completionPct = Math.round(completionRatio * 100);
  const winRate = totals.multiplayerRaces > 0 ? totals.wins / totals.multiplayerRaces : null;
  const historyHref = prefixWithLocale("/history", locale);

  return (
    <section
      aria-label={labels.ariaLabel}
      className="min-w-0 overflow-hidden rounded-panel border-2 border-screen bg-screen text-screen-text shadow-soft"
    >
      {/* Bandeau supérieur de piste */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-screen-border bg-screen-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="inline-block h-3.5 w-6 skew-x-[-14deg] bg-track-accent" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-screen-muted">
            {labels.ariaLabel}
          </span>
        </div>

        {/* Tendance récente */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-screen-muted">{labels.trendLabel}</span>
          {trend ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 tabular-nums ${
                trend.direction === "up"
                  ? "bg-key-mint text-key-ink"
                  : trend.direction === "down"
                    ? "bg-key-coral text-key-ink"
                    : "bg-screen border border-screen-border text-screen-text"
              }`}
            >
              {trend.direction === "up" ? (
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              ) : trend.direction === "down" ? (
                <ArrowDownRight aria-hidden="true" className="size-3.5" />
              ) : (
                <Minus aria-hidden="true" className="size-3.5" />
              )}
              <span>
                {trend.direction === "up"
                  ? labels.trendUp.replace("{delta}", number.format(trend.delta))
                  : trend.direction === "down"
                    ? labels.trendDown.replace("{delta}", number.format(trend.delta))
                    : labels.trendFlat}
              </span>
            </span>
          ) : (
            <span className="text-screen-muted">{labels.trendNeedMore}</span>
          )}
        </div>
      </div>

      {/* Corps du tableau géant : Record vedette + 4 cadrans télémétriques */}
      <div className="grid grid-cols-1 gap-px bg-screen-border lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Record personnel vedette */}
        <div className="flex min-w-0 flex-col justify-between gap-4 bg-screen p-5 sm:p-7">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-key-yellow">
              <Trophy aria-hidden="true" className="size-4" />
              <span>{labels.recordLabel}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-display text-[clamp(4.25rem,12vw,6.5rem)] font-black leading-[0.88] tracking-tight tabular-nums text-key-yellow">
                {totals.bestWpm === null ? noValue : number.format(totals.bestWpm)}
              </p>
              <span className="font-display text-2xl font-extrabold uppercase tracking-wide text-screen-muted">
                {labels.recordUnit}
              </span>
            </div>
          </div>

          {bestRace && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-screen-border pt-3 text-xs text-screen-muted">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                <time dateTime={bestRace.endedAt.toISOString()}>{date.format(bestRace.endedAt)}</time>
                <span>{labels.recordGross.replace("{wpm}", number.format(bestRace.grossWpm))}</span>
                <span className="text-key-mint">
                  {labels.recordAccuracy.replace("{accuracy}", percent.format(bestRace.accuracy / 100))}
                </span>
              </div>
              <Link
                href={`${historyHref}/${bestRace.raceId}`}
                className="inline-flex items-center gap-1 font-semibold text-key-yellow underline-offset-4 hover:underline"
              >
                <span>{labels.viewRecord}</span>
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* 4 cadrans télémétriques */}
        <dl className="grid grid-cols-2 gap-px bg-screen-border">
          <div className="flex min-w-0 flex-col justify-between bg-screen-surface p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wider text-screen-muted">{labels.averageWpm}</dt>
            <dd className="mt-2 font-display text-4xl font-black leading-none tabular-nums text-screen-text sm:text-5xl">
              {totals.averageWpm === null ? noValue : number.format(totals.averageWpm)}
            </dd>
            <dd className="mt-2 text-xs tabular-nums text-screen-muted">
              {totals.averageGrossWpm === null
                ? noValue
                : labels.averageGross.replace("{wpm}", number.format(totals.averageGrossWpm))}
            </dd>
          </div>

          <div className="flex min-w-0 flex-col justify-between bg-screen-surface p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wider text-screen-muted">{labels.averageAccuracy}</dt>
            <dd className="mt-2 font-display text-4xl font-black leading-none tabular-nums text-key-mint sm:text-5xl">
              {totals.averageAccuracy === null ? noValue : percent.format(totals.averageAccuracy / 100)}
            </dd>
            <dd className="mt-2 text-xs tabular-nums text-screen-muted">
              {labels.completionTrack} · {percentWhole.format(completionRatio)}
            </dd>
          </div>

          <div className="flex min-w-0 flex-col justify-between bg-screen-surface p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wider text-screen-muted">{labels.races}</dt>
            <dd className="mt-2 font-display text-4xl font-black leading-none tabular-nums text-screen-text sm:text-5xl">
              {integer.format(totals.raceCount)}
            </dd>
            <dd className="mt-2 text-xs tabular-nums text-screen-muted">
              {labels.racesSplit
                .replace("{finished}", integer.format(totals.finishedCount))
                .replace("{abandoned}", integer.format(totals.abandonedCount))}
            </dd>
          </div>

          <div className="flex min-w-0 flex-col justify-between bg-screen-surface p-4 sm:p-5">
            <dt className="text-xs font-bold uppercase tracking-wider text-screen-muted">{labels.wins}</dt>
            <dd className="mt-2 font-display text-4xl font-black leading-none tabular-nums text-key-yellow sm:text-5xl">
              {integer.format(totals.wins)}
            </dd>
            <dd className="mt-2 text-xs tabular-nums text-screen-muted">
              {winRate !== null
                ? `${labels.winRate.replace("{rate}", percentWhole.format(winRate))} · ${labels.podiums.replace("{count}", integer.format(totals.podiums))}`
                : labels.podiums.replace("{count}", integer.format(totals.podiums))}
            </dd>
          </div>
        </dl>
      </div>

      {/* Réglette de piste (écho à .race-distance / .race-ruler de l'écran de course) */}
      <div className="flex flex-wrap items-center gap-3 border-t border-screen-border bg-screen px-4 py-3 text-xs sm:px-6">
        <span className="font-bold uppercase tracking-wider text-key-mint">{labels.completionTrack}</span>
        <div
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={labels.completionSummary
            .replace("{finished}", integer.format(totals.finishedCount))
            .replace("{total}", integer.format(totals.raceCount))
            .replace("{rate}", percentWhole.format(completionRatio))}
          className="race-ruler min-w-32"
        >
          <span className="race-distance-fill" style={{ width: `${completionPct}%` }} />
        </div>
        <span className="font-bold tabular-nums text-screen-text">
          {integer.format(totals.finishedCount)} / {integer.format(totals.raceCount)}
        </span>
        <span aria-hidden="true" className="track-checker ml-auto hidden h-3 w-12 rounded-xs sm:block" />
      </div>
    </section>
  );
}
