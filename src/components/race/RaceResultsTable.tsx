import { Flag, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { AvatarIdentity } from "@/components/avatar";
import { formatBotSuffix } from "./formatRacerName";
import type { ServerToClientEvents } from "@/realtime/protocol";
import type { Dictionary } from "@/i18n/dictionaries";

type ResultEventRow = Parameters<ServerToClientEvents["race:results"]>[0][number];

export type RaceResultsRow = Pick<
  ResultEventRow,
  "id" | "name" | "rank" | "wpm" | "grossWpm" | "accuracy" | "errors" | "timeMs" | "status"
> &
  Partial<Pick<ResultEventRow, "level" | "bonusesReceived" | "bonusTypes">> & {
    isBot?: boolean;
    avatar?: AvatarIdentity;
    personalBest?: boolean;
  };

type Props = {
  rows: RaceResultsRow[];
  lang: string;
  labels: Dictionary["raceScreen"]["results"];
  extraLabels: Pick<Dictionary["room"]["race"], "grossWpm" | "errors" | "bot">;
  highlightId: string;
  botLevels: Dictionary["raceScreen"]["botLevels"];
  headingLevel?: "h2" | "h3";
};

function rankBadgeClass(rank: number): string {
  if (rank === 1) return "bg-key-yellow text-key-ink";
  if (rank === 2) return "bg-key-mint text-key-ink";
  if (rank === 3) return "bg-key-coral text-key-ink";
  return "bg-background text-foreground border border-border";
}

function statusBadgeClass(status: RaceResultsRow["status"]): string {
  if (status === "finished") return "bg-key-mint text-key-ink";
  if (status === "abandoned") return "bg-key-coral text-key-ink";
  return "border border-border bg-background text-muted";
}

export function RaceResultsTable({
  rows,
  lang,
  labels,
  extraLabels,
  highlightId,
  botLevels,
  headingLevel = "h3",
}: Props) {
  const columns = labels.columns;
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const integer = new Intl.NumberFormat(lang);
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  const seconds = new Intl.NumberFormat(lang, { style: "unit", unit: "second", maximumFractionDigits: 1 });
  const Heading = headingLevel;

  return (
    <section className="min-w-0 overflow-hidden rounded-card border border-border bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6">
        <Heading className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
          <Flag aria-hidden="true" className="size-5 shrink-0 text-accent-text" />
          <span>{labels.standingsTitle}</span>
        </Heading>
        <span aria-hidden="true" className="race-checks hidden sm:inline-block" />
      </div>

      <div tabIndex={0} role="region" aria-label={labels.tableTitle} className="overflow-x-auto">
        <table className="w-full min-w-[42rem] table-fixed text-left text-sm">
          <caption className="sr-only">{labels.tableTitle}</caption>
          <colgroup>
            {["7%", "27%", "8%", "8%", "10%", "8%", "9%", "10%", "13%"].map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-background text-xs font-extrabold uppercase tracking-wider text-muted">
              {[
                columns.rank,
                columns.name,
                columns.wpm,
                extraLabels.grossWpm,
                columns.accuracy,
                extraLabels.errors,
                columns.time,
                columns.bonuses,
                columns.status,
              ].map((label) => (
                <th key={label} scope="col" className="px-2 py-3 first:pl-card last:pr-card">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isLocal = row.id === highlightId;
              return (
                <tr
                  key={row.id}
                  className={`border-t border-border transition-colors duration-150 ${
                    isLocal ? "bg-accent-panel font-bold" : "hover:bg-background"
                  }`}
                >
                  <td className="py-3 pl-card pr-2 tabular-nums">
                    <span
                      className={`inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-extrabold ${rankBadgeClass(row.rank)}`}
                    >
                      {integer.format(row.rank)}
                    </span>
                  </td>
                  <th scope="row" className="px-2 py-3 font-semibold">
                    <span className="flex items-start gap-2.5">
                      <Avatar name={row.name} {...(row.avatar ?? { seed: row.id })} size={26} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        <span className={isLocal ? "font-extrabold text-foreground" : "text-foreground"}>
                          {row.name}
                          {formatBotSuffix(Boolean(row.isBot), row.level, extraLabels.bot, botLevels)}
                        </span>
                        {row.personalBest && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-key-yellow px-2 py-0.5 text-[11px] font-extrabold text-key-ink">
                            <Trophy aria-hidden="true" className="size-3" />
                            <span>{labels.personalBest}</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  <td className="px-2 py-3 font-extrabold tabular-nums text-foreground">{number.format(row.wpm)}</td>
                  <td className="px-2 py-3 tabular-nums text-muted">{number.format(row.grossWpm)}</td>
                  <td className="px-2 py-3 tabular-nums">{percent.format(row.accuracy / 100)}</td>
                  <td className="px-2 py-3 tabular-nums">{integer.format(row.errors)}</td>
                  <td className="px-2 py-3 tabular-nums">{seconds.format(row.timeMs / 1000)}</td>
                  <td className="px-2 py-3 tabular-nums">
                    {integer.format(row.bonusesReceived ?? 0)}
                    {row.bonusTypes?.length
                      ? ` (${row.bonusTypes.map((type) => labels.bonusTypes[type]).join(", ")})`
                      : ""}
                  </td>
                  <td className="py-3 pl-2 pr-card tabular-nums">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(row.status)}`}
                    >
                      {labels.statuses[row.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
