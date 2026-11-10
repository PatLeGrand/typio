import { Avatar } from "@/components/Avatar";
import type { AvatarIdentity } from "@/components/avatar";
import type { BonusType } from "@/race/bonuses";
import type { BotLevel } from "@/realtime/protocol";
import type { Dictionary } from "@/i18n/dictionaries";

export type RaceResultsRow = {
  id: string;
  name: string;
  isBot?: boolean;
  avatar?: AvatarIdentity;
  level?: BotLevel;
  personalBest?: boolean;
  rank: number;
  wpm: number;
  grossWpm: number;
  accuracy: number;
  errors: number;
  bonusesReceived?: number;
  bonusTypes?: BonusType[];
  timeMs: number;
  status: "finished" | "unfinished" | "abandoned";
};

type Props = {
  rows: RaceResultsRow[];
  lang: string;
  labels: Dictionary["raceScreen"]["results"];
  extraLabels: Pick<Dictionary["room"]["race"], "grossWpm" | "errors" | "bot">;
  highlightId: string;
  botLevels: Dictionary["raceScreen"]["botLevels"];
};

export function RaceResultsTable({ rows, lang, labels, extraLabels, highlightId, botLevels }: Props) {
  const columns = labels.columns;
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  const seconds = new Intl.NumberFormat(lang, { style: "unit", unit: "second", maximumFractionDigits: 1 });
  return (
    <div tabIndex={0} role="region" aria-label={labels.tableTitle} className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[40rem] table-fixed text-left text-sm">
        <caption className="sr-only">{labels.tableTitle}</caption>
        <colgroup>
          {["7.5%", "20.5%", "8%", "10%", "11%", "9%", "10%", "11%", "13%"].map((width, index) => <col key={index} style={{ width }} />)}
        </colgroup>
        <thead><tr>
          {[columns.rank, columns.name, columns.wpm, extraLabels.grossWpm, columns.accuracy, extraLabels.errors, columns.time, columns.bonuses, columns.status].map((label) => <th key={label} scope="col" className="px-2 py-2">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.id} className={`border-t border-border ${row.id === highlightId ? "bg-accent-panel font-bold" : ""}`}>
            <td className="px-2 py-2 tabular-nums">{number.format(row.rank)}</td>
            <th scope="row" className="px-2 py-2"><span className="flex items-start gap-2"><Avatar name={row.name} {...(row.avatar ?? { seed: row.id })} size={24} /><span className="min-w-0 [overflow-wrap:anywhere]">{row.name}{row.isBot ? ` (${extraLabels.bot}${row.level ? ` · ${botLevels[row.level]}` : ""})` : ""}{row.personalBest && <span className="ml-2 rounded border border-border px-2 py-1 text-xs text-accent-text">{labels.personalBest}</span>}</span></span></th>
            <td className="px-2 py-2 tabular-nums">{number.format(row.wpm)}</td>
            <td className="px-2 py-2 tabular-nums">{number.format(row.grossWpm)}</td>
            <td className="px-2 py-2 tabular-nums">{percent.format(row.accuracy / 100)}</td>
            <td className="px-2 py-2 tabular-nums">{number.format(row.errors)}</td>
            <td className="px-2 py-2 tabular-nums">{seconds.format(row.timeMs / 1000)}</td>
            <td className="px-2 py-2 tabular-nums">{number.format(row.bonusesReceived ?? 0)}{row.bonusTypes?.length ? ` (${row.bonusTypes.map((type) => labels.bonusTypes[type]).join(", ")})` : ""}</td>
            <td className="px-2 py-2 tabular-nums">{labels.statuses[row.status]}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
