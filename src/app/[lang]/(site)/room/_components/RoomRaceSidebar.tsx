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

export function RoomRaceSidebar({ runners, userId, lang, code, codeLabels, labels, raceLabels }: Props) {
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  return (
    <aside aria-label={raceLabels.leaderboard} className="mx-4 mt-4 flex min-h-0 flex-col rounded-card border border-border bg-surface p-3 shadow-soft md:mx-8 lg:absolute lg:right-4 lg:top-4 lg:mx-0 lg:mt-0 lg:max-h-[calc(var(--race-track-height)-2rem)] lg:w-64">
      {code && <RoomCodeCard compact code={code} labels={codeLabels} />}
      <h2 className="mb-2 text-sm font-bold text-balance lg:mb-1">{raceLabels.leaderboard}</h2>
      <ol tabIndex={0} aria-label={raceLabels.leaderboard} className="min-h-0 space-y-2 lg:space-y-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text">
        {[...runners].sort((a, b) => b.progress - a.progress).map((r) => <li key={r.id} className={`flex min-w-0 items-start gap-2 rounded-field p-2 lg:p-1 ${r.id === userId ? "bg-accent-panel font-bold" : "bg-surface"}`}>
          <Avatar name={r.name} {...runnerAvatar(r)} size={24} />
          <div className="min-w-0 flex-1 text-xs">
            <p className="break-words">{r.name}{formatBotSuffix(r.kind === "bot", r.level, labels.bot, raceLabels.botLevels)} {r.id === userId ? `(${raceLabels.you})` : ""}</p>
            <p className="mt-1 tabular-nums text-muted-strong lg:mt-0">{number.format(r.wpm)} {raceLabels.results.columns.wpm}{" · "}{number.format(r.position)} / {number.format(r.textLength)} {raceLabels.typing.characters}</p>
          </div>
        </li>)}
      </ol>
    </aside>
  );
}
