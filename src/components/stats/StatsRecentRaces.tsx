import Link from "next/link";
import { ArrowUpRight, Flag } from "lucide-react";
import { RaceHistoryTable } from "@/components/race/RaceHistoryTable";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { prefixWithLocale } from "@/i18n/paths";
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
          className="road-link-inline inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent-text"
        >
          <span>{labels.viewAll}</span>
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <RaceHistoryTable
        rows={races}
        locale={locale}
        caption={labels.caption}
        resultLabels={resultLabels}
        historyLabels={historyLabels}
        modeColumn={{
          label: labels.modeColumn,
          modeLabels,
          languageLabels,
        }}
        durationColumnLabel={labels.durationColumn}
        className="mt-4 rounded-field border border-border bg-surface"
      />
    </section>
  );
}
