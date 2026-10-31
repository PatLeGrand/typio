import { Trophy } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatOrdinal } from "@/race/format";

type Props = {
  rows: readonly { id: string; name: string; rank: number; wpm: number }[];
  locale: string;
  labels: Dictionary["raceScreen"];
  highlightId?: string;
};

export function RacePodium({ rows, locale, labels, highlightId }: Props) {
  const number = new Intl.NumberFormat(locale);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-lg font-extrabold">
        <Trophy aria-hidden="true" className="size-5 text-accent-text" />
        {labels.results.podium}
      </h3>
      <ol className="grid gap-3 sm:grid-cols-3">
        {rows.slice(0, 3).map((row) => (
          <li key={row.id} className={`flex min-w-0 flex-col gap-1 rounded-card border-2 px-5 py-4 ${row.id === highlightId ? "border-accent bg-accent-panel" : "border-border bg-surface"}`}>
            <span className="text-2xl font-black text-accent-text">{formatOrdinal(locale, row.rank, labels.ordinal)}</span>
            <span className="break-words font-extrabold">{row.name}</span>
            <span className="text-sm text-muted">{number.format(row.wpm)} {labels.results.columns.wpm}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
