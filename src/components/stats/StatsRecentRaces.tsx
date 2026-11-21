import Link from "next/link";
import { ArrowUpRight, Flag } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { prefixWithLocale } from "@/i18n/paths";
import { formatDuration } from "@/race/format";
import type { RecentRaceItem } from "@/race/personalStats";

type Props = {
  races: readonly RecentRaceItem[];
  locale: Locale;
  labels: Dictionary["stats"]["recent"];
  modeLabels: Dictionary["stats"]["breakdowns"]["modes"];
  languageLabels: Dictionary["stats"]["breakdowns"]["languages"];
  resultLabels: Dictionary["raceScreen"]["results"];
  historyLabels: Pick<Dictionary["history"], "date" | "actions" | "view">;
};

export function StatsRecentRaces({
  races,
  locale,
  labels,
  modeLabels,
  languageLabels,
  resultLabels,
  historyLabels,
}: Props) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const historyHref = prefixWithLocale("/history", locale);

  return (
    <section
      aria-labelledby="stats-recent-title"
      className="min-w-0 rounded-card border border-border bg-surface p-4 shadow-soft sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2
            id="stats-recent-title"
            className="flex items-center gap-2 font-display text-3xl font-black uppercase tracking-tight text-foreground sm:text-4xl"
          >
            <Flag aria-hidden="true" className="size-6 shrink-0 text-accent-text" />
            <span>{labels.title}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
        </div>
        <Link
          href={historyHref}
          className="road-link-inline inline-flex items-center gap-1 text-sm font-semibold text-accent-text"
        >
          <span>{labels.viewAll}</span>
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label={labels.caption}
        className="mt-4 overflow-x-auto rounded-field border border-border"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{labels.caption}</caption>
          <thead>
            <tr className="bg-background text-xs uppercase tracking-wider text-muted">
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 pl-4 font-semibold">
                {historyLabels.date}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {labels.modeColumn}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {resultLabels.columns.rank}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {resultLabels.columns.wpm}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {resultLabels.columns.accuracy}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {labels.durationColumn}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 font-semibold">
                {resultLabels.columns.status}
              </th>
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 pr-4 font-semibold">
                {historyLabels.actions}
              </th>
            </tr>
          </thead>
          <tbody>
            {races.map((row) => (
              <tr key={row.raceId} className="border-t border-border hover:bg-accent-soft/50">
                <th scope="row" className="whitespace-nowrap py-3 pl-4 pr-3 font-medium text-foreground">
                  <time dateTime={row.endedAt.toISOString()}>{date.format(row.endedAt)}</time>
                </th>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">
                  {modeLabels[row.textMode]} · {languageLabels[row.language]}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                  {integer.format(row.rank)} / {integer.format(row.participantCount)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                  <span className="font-bold text-foreground">{number.format(row.wpm)}</span>
                  {row.personalBest && (
                    <span className="ml-2 rounded-full bg-key-yellow px-2 py-0.5 text-xs font-bold text-key-ink">
                      {resultLabels.personalBest}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                  {percent.format(row.accuracy / 100)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums text-muted">
                  {formatDuration(row.durationMs)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs font-medium">
                  {resultLabels.statuses[row.status]}
                </td>
                <td className="whitespace-nowrap px-3 py-3 pr-4">
                  <Link
                    href={`${historyHref}/${row.raceId}`}
                    className="road-link-inline font-semibold text-accent-text"
                  >
                    {historyLabels.view}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
