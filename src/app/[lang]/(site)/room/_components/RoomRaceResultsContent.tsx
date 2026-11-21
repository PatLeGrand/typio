import type { ReactNode } from "react";
import { runnerAvatar } from "@/components/avatar";
import { MissedKeysHeatmap } from "@/components/race/MissedKeysHeatmap";
import { formatBotSuffix } from "@/components/race/formatRacerName";
import { RacePodium } from "@/components/race/RacePodium";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { WpmChart } from "@/components/race/WpmChart";
import type { Dictionary } from "@/i18n/dictionaries";
import type { UseRoom } from "@/realtime/useRoom";

type Props = {
  results: NonNullable<UseRoom["results"]>;
  self: UseRoom["self"];
  /** Identifiants des joueurs qui viennent de battre leur record. */
  records: string[];
  userId: string;
  lang: string;
  labels: Dictionary["room"]["race"];
  raceLabels: Dictionary["raceScreen"];
  actions?: ReactNode;
};

/** Podium, actions rapides, télémétrie (courbe + touches manquées) et tableau des résultats. */
export function RoomRaceResultsContent({ results, self, records, userId, lang, labels, raceLabels, actions }: Props) {
  const localResult = results.find((row) => row.id === userId && row.kind === "human");
  const hasHeatmap = Boolean(localResult && self?.missedKeys);
  const displayRows = results.map((row) => ({
    ...row,
    avatar: runnerAvatar(row),
    name: `${row.name}${formatBotSuffix(row.kind === "bot", row.level, labels.bot, raceLabels.botLevels)}`,
    personalBest: records.includes(row.id),
  }));

  return (
    <>
      <RacePodium rows={displayRows} locale={lang} labels={raceLabels} highlightId={userId} />
      {actions}
      <div className={hasHeatmap ? "grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start" : "min-w-0"}>
        <WpmChart rows={displayRows} locale={lang} labels={raceLabels.results} highlightId={userId} />
        {localResult && self?.missedKeys && (
          <MissedKeysHeatmap missedKeys={self.missedKeys} locale={lang} labels={raceLabels.results} />
        )}
      </div>
      <RaceResultsTable
        rows={results.map((row) => ({
          ...row,
          avatar: runnerAvatar(row),
          isBot: row.kind === "bot",
          personalBest: records.includes(row.id),
        }))}
        lang={lang}
        labels={raceLabels.results}
        extraLabels={labels}
        botLevels={raceLabels.botLevels}
        highlightId={userId}
      />
    </>
  );
}
