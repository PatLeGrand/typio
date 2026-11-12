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
};

/** Podium, courbe, touches manquées et tableau des résultats d'une course de salle. */
export function RoomRaceResultsContent({ results, self, records, userId, lang, labels, raceLabels }: Props) {
  const localResult = results.find((row) => row.id === userId && row.kind === "human");
  const displayRows = results.map((row) => ({ ...row, avatar: runnerAvatar(row), name: `${row.name}${formatBotSuffix(row.kind === "bot", row.level, labels.bot, raceLabels.botLevels)}` }));
  return (
    <>
      <RacePodium rows={displayRows} locale={lang} labels={raceLabels} highlightId={userId} />
      <WpmChart rows={displayRows} locale={lang} labels={raceLabels.results} highlightId={userId} />
      {localResult && self?.missedKeys && <MissedKeysHeatmap missedKeys={self.missedKeys} locale={lang} labels={raceLabels.results} />}
      <RaceResultsTable rows={results.map((row) => ({ ...row, avatar: runnerAvatar(row), isBot: row.kind === "bot", personalBest: records.includes(row.id) }))} lang={lang} labels={raceLabels.results} extraLabels={labels} botLevels={raceLabels.botLevels} highlightId={userId} />
    </>
  );
}
