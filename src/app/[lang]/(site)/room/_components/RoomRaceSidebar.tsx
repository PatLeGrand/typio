import { memo } from "react";
import { Avatar } from "@/components/Avatar";
import { runnerAvatar } from "@/components/avatar";
import { formatBotSuffix } from "@/components/race/formatRacerName";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UseRoom } from "@/realtime/useRoom";
import { RoomCodeCard } from "./RoomCodeCard";

type Props = {
  runners: NonNullable<UseRoom["race"]>["runners"];
  userId: string;
  lang: string;
  code?: string;
  codeLabels: Dictionary["room"]["code"];
  labels: Dictionary["room"]["race"];
  raceLabels: Dictionary["raceScreen"];
};

export const RoomRaceSidebar = memo(function RoomRaceSidebar({ runners, userId, lang, code, codeLabels, labels, raceLabels }: Props) {
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  return (
    <aside aria-label={raceLabels.leaderboard} className="min-w-0 self-start">
      <div className="race-standings-head">
        <h2>{raceLabels.leaderboard}</h2>
        <span className="race-checks" aria-hidden="true" />
      </div>
      <ol tabIndex={0} aria-label={raceLabels.leaderboard} className="max-h-80 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
        {[...runners].sort((a, b) => b.progress - a.progress).map((r, index) => <li key={r.id} className={`flex min-w-0 items-center gap-2.5 border-b border-border px-3 py-3 ${r.id === userId ? "bg-island-mint font-bold" : "bg-surface"}`}>
          <span aria-hidden="true" className="w-6 shrink-0 font-display text-xl font-black italic tabular-nums">{number.format(index + 1)}</span>
          <Avatar name={r.name} {...runnerAvatar(r)} size={24} />
          <div className="min-w-0 flex-1 text-xs">
            <p className="break-words text-sm font-bold">{r.name}{formatBotSuffix(r.kind === "bot", r.level, labels.bot, raceLabels.botLevels)} {r.id === userId ? `(${raceLabels.you})` : ""}</p>
            <p className="mt-1 tabular-nums text-muted-strong lg:mt-0">{number.format(r.wpm)} {raceLabels.results.columns.wpm}{" · "}{number.format(r.position)} / {number.format(r.textLength)} {raceLabels.typing.characters}</p>
          </div>
        </li>)}
      </ol>
      {code && <div className="mt-4"><RoomCodeCard compact code={code} labels={codeLabels} /></div>}
    </aside>
  );
});
