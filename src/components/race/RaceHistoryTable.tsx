import Link from "next/link";
import { ArrowUpRight, Check, Clock, Trophy, X } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { prefixWithLocale } from "@/i18n/paths";
import { formatDuration } from "@/race/format";
import type { RaceStatus } from "@/race/personalStats";
import type { TextLanguage, TextMode } from "@/realtime/protocol";

export type RaceHistoryRow = {
  raceId: string;
  endedAt: Date;
  rank: number;
  participantCount: number;
  wpm: number;
  accuracy: number;
  personalBest: boolean;
  status: RaceStatus;
  textMode?: TextMode;
  language?: TextLanguage;
  durationMs?: number;
};

type Props = {
  rows: readonly RaceHistoryRow[];
  locale: Locale;
  caption: string;
  resultLabels: Dictionary["raceScreen"]["results"];
  historyLabels: Pick<Dictionary["history"], "date" | "actions" | "view">;
  modeColumn?: {
    label: string;
    modeLabels: Dictionary["stats"]["breakdowns"]["modes"];
    languageLabels: Dictionary["stats"]["breakdowns"]["languages"];
  };
  durationColumnLabel?: string;
  className?: string;
};

const STATUS_STYLES: Record<RaceStatus, { pill: string; Icon: typeof Check }> = {
  finished: {
    pill: "bg-key-mint text-key-ink",
    Icon: Check,
  },
  abandoned: {
    pill: "bg-key-coral text-key-ink",
    Icon: X,
  },
  unfinished: {
    pill: "border border-border bg-accent-soft text-muted",
    Icon: Clock,
  },
};

const MOBILE_LABEL_CLASS =
  "before:mb-1 before:block before:text-[11px] before:font-semibold before:uppercase before:tracking-wider before:text-muted before:content-[attr(data-label)] md:before:content-none";

export function RaceHistoryTable({
  rows,
  locale,
  caption,
  resultLabels,
  historyLabels,
  modeColumn,
  durationColumnLabel,
  className = "rounded-card border border-border bg-surface shadow-soft",
}: Props) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const historyHref = prefixWithLocale("/history", locale);
  const { columns, statuses } = resultLabels;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={caption}
      className={`min-w-0 overflow-x-auto ${className}`}
    >
      <table className="block w-full text-left text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="sr-only md:not-sr-only md:table-header-group">
          <tr className="border-b border-border bg-background text-xs uppercase tracking-wider text-muted">
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 pl-6 font-semibold">
              {historyLabels.date}
            </th>
            {modeColumn && (
              <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
                {modeColumn.label}
              </th>
            )}
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
              {columns.rank}
            </th>
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
              {columns.wpm}
            </th>
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
              {columns.accuracy}
            </th>
            {durationColumnLabel && (
              <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
                {durationColumnLabel}
              </th>
            )}
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">
              {columns.status}
            </th>
            <th scope="col" className="whitespace-nowrap px-4 py-3.5 pr-6 text-right font-semibold">
              {historyLabels.actions}
            </th>
          </tr>
        </thead>
        <tbody className="block divide-y divide-border md:table-row-group md:divide-y-0">
          {rows.map((row) => {
            const { pill, Icon: StatusIcon } = STATUS_STYLES[row.status];
            const isWinner = row.rank === 1;
            return (
              <tr
                key={row.raceId}
                className="group relative grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-accent-soft/60 focus-within:bg-accent-soft/60 motion-reduce:transition-none md:table-row md:border-t md:border-border md:px-0 md:py-0"
              >
                <th
                  scope="row"
                  className="col-span-2 block text-left text-sm font-medium text-foreground md:table-cell md:whitespace-nowrap md:py-4 md:pl-6 md:pr-4 md:align-middle"
                >
                  <time dateTime={row.endedAt.toISOString()}>{date.format(row.endedAt)}</time>
                </th>

                {modeColumn && (
                  <td
                    data-label={modeColumn.label}
                    className="col-span-2 -mt-1.5 block text-xs text-muted md:mt-0 md:table-cell md:whitespace-nowrap md:px-4 md:py-4 md:align-middle"
                  >
                    {row.textMode ? modeColumn.modeLabels[row.textMode] : ""}
                    {row.textMode && row.language ? " · " : ""}
                    {row.language ? modeColumn.languageLabels[row.language] : ""}
                  </td>
                )}

                <td
                  data-label={columns.rank}
                  className={`${MOBILE_LABEL_CLASS} block whitespace-nowrap tabular-nums md:table-cell md:px-4 md:py-4 md:align-middle`}
                >
                  {isWinner ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-key-yellow px-2.5 py-0.5 text-xs font-bold text-key-ink">
                      <Trophy aria-hidden="true" className="size-3.5 shrink-0" />
                      <span>
                        {integer.format(row.rank)} / {integer.format(row.participantCount)}
                      </span>
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold text-foreground">{integer.format(row.rank)}</span>
                      <span className="text-muted"> / {integer.format(row.participantCount)}</span>
                    </span>
                  )}
                </td>

                <td
                  data-label={columns.wpm}
                  className={`${MOBILE_LABEL_CLASS} block tabular-nums md:table-cell md:whitespace-nowrap md:px-4 md:py-4 md:align-middle`}
                >
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-foreground">{number.format(row.wpm)}</span>
                    {row.personalBest && (
                      <span className="rounded-full bg-key-yellow px-2.5 py-0.5 text-xs font-bold text-key-ink">
                        {resultLabels.personalBest}
                      </span>
                    )}
                  </span>
                </td>

                <td
                  data-label={columns.accuracy}
                  className={`${MOBILE_LABEL_CLASS} block whitespace-nowrap font-medium tabular-nums text-foreground md:table-cell md:px-4 md:py-4 md:align-middle`}
                >
                  {percent.format(row.accuracy / 100)}
                </td>

                {durationColumnLabel && (
                  <td
                    data-label={durationColumnLabel}
                    className={`${MOBILE_LABEL_CLASS} block whitespace-nowrap tabular-nums text-muted md:table-cell md:px-4 md:py-4 md:align-middle`}
                  >
                    {row.durationMs !== undefined ? formatDuration(row.durationMs) : ""}
                  </td>
                )}

                <td
                  data-label={columns.status}
                  className={`${MOBILE_LABEL_CLASS} block whitespace-nowrap md:table-cell md:px-4 md:py-4 md:align-middle`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${pill}`}
                  >
                    <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span>{statuses[row.status]}</span>
                  </span>
                </td>

                <td className="col-span-2 flex justify-end border-t border-border/60 pt-1 md:table-cell md:whitespace-nowrap md:border-t-0 md:px-4 md:py-2 md:pr-6 md:text-right md:align-middle">
                  <Link
                    href={`${historyHref}/${row.raceId}`}
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent-text after:absolute after:inset-0 after:content-['']"
                  >
                    <span className="road-link-inline">{historyLabels.view}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                    />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
