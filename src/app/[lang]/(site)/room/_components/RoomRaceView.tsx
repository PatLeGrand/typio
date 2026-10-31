"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { playerBonusMessage, racerBonusLabel } from "@/components/race/bonusAnnouncements";
import { RacePodium } from "@/components/race/RacePodium";
import { WpmChart } from "@/components/race/WpmChart";
import { RaceResultsTable } from "@/components/race/RaceResultsTable";
import { RaceTypingPanel } from "@/components/race/RaceTypingPanel";
import { RaceVisualizer } from "@/components/race/RaceVisualizer";
import type { Dictionary } from "@/i18n/dictionaries";
import { applyTextEdits } from "@/race/bonuses";
import { applyTypedInput, countCorrectChars } from "@/race/metrics";
import { createRaceInputBuffer, raceInputOps } from "@/realtime/raceInput";
import { getSocket } from "@/realtime/client";
import type { RoomState } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";

type Props = {
  room: RoomState;
  userId: string;
  lang: string;
  labels: Dictionary["room"]["race"];
  raceLabels: Dictionary["raceScreen"];
  session: Pick<UseRoom, "race" | "results" | "self" | "raceReceivedAt" | "connection" | "sendInput" | "abandonRace" | "restartRace" | "closeRoom">;
};

const KEYBOARD_QUERY = "(min-width: 768px) and (pointer: fine)";
function subscribeKeyboard(listener: () => void) {
  const query = window.matchMedia(KEYBOARD_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const keyboardSnapshot = () => window.matchMedia(KEYBOARD_QUERY).matches;
const serverKeyboardSnapshot = () => false;

/** Saisie optimiste ; piste et classement restent entièrement pilotés par le serveur. */
export function RoomRaceView({ room, userId, lang, labels, raceLabels, session }: Props) {
  const { race, results, self, raceReceivedAt, connection, sendInput, abandonRace, restartRace, closeRoom } = session;
  const [records, setRecords] = useState<string[]>([]);
  const [recordStart, setRecordStart] = useState(race?.startAt);
  if (recordStart !== race?.startAt) {
    setRecordStart(race?.startAt);
    setRecords([]);
  }
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onRecords = ({ userIds }: { userIds: string[] }) => setRecords(userIds);
    socket.on("race:records", onRecords);
    return () => { socket.off("race:records", onRecords); };
  }, []);
  const [input, setInput] = useState(self ?? { typed: "", keystrokes: { total: 0, correct: 0 } });
  const [resumedSelf, setResumedSelf] = useState(self);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const physicalKeyboard = useSyncExternalStore(subscribeKeyboard, keyboardSnapshot, serverKeyboardSnapshot);
  const buffer = useMemo(() => createRaceInputBuffer(sendInput), [sendInput]);

  // Une reprise remplace la prédiction et élimine les frappes de l'ancienne connexion.
  if (self !== resumedSelf) {
    setResumedSelf(self);
    setInput(self ?? { typed: "", keystrokes: { total: 0, correct: 0 } });
  }
  useEffect(() => {
    buffer.clear();
  }, [buffer, self, connection, room.status]);
  useEffect(() => () => buffer.clear(), [buffer]);
  useEffect(() => {
    if (room.status !== "countdown" && room.status !== "racing") return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 50);
    return () => clearInterval(timer);
  }, [room.status]);

  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  const runner = race?.runners.find((r) => r.id === userId && r.kind === "human");
  const text = race ? applyTextEdits(race.text, runner?.edits ?? []) : "";
  const active = runner?.status === "ready" || runner?.status === "typing";
  const serverTime = race ? race.serverNow + Math.max(0, (now ?? raceReceivedAt ?? 0) - (raceReceivedAt ?? 0)) : 0;
  const countdown = race ? Math.min(3, Math.max(1, Math.ceil((race.startAt - serverTime) / 1000))) : 3;

  async function command(action: () => Promise<unknown>) {
    setPending(true);
    try { await action(); } finally { setPending(false); }
  }

  function change(value: string) {
    if (!race || !active || connection !== "connected" || pending || race.status !== "racing" || room.status !== "racing" || input.typed === text) return;
    const ops = raceInputOps(input.typed, value);
    let next = input;
    for (const op of ops) {
      const typed = op === "\b" ? next.typed.slice(0, -1) : next.typed + op;
      next = applyTypedInput(next.typed, typed, text, room.config.inputMode, next.keystrokes);
    }
    setInput(next);
    buffer.push(ops);
  }

  if (room.status === "results") {
    const displayRows = results?.map((row) => ({ ...row, name: `${row.name}${row.kind === "bot" ? ` (${labels.bot}${row.level ? ` · ${raceLabels.botLevels[row.level]}` : ""})` : ""}` }));
    return (
      <section className="flex flex-col gap-4" aria-label={raceLabels.results.tableTitle}>
        <h2 className="text-2xl font-bold">{raceLabels.results.tableTitle}</h2>
        {records.includes(userId) && <p role="status">{raceLabels.results.newPersonalBest}</p>}
        {results && displayRows ? (
          <>
            <RacePodium rows={displayRows} locale={lang} labels={raceLabels} highlightId={userId} />
            <WpmChart rows={displayRows} locale={lang} labels={raceLabels.results} highlightId={userId} />
            <RaceResultsTable rows={results.map((row) => ({ ...row, isBot: row.kind === "bot", personalBest: records.includes(row.id) }))} lang={lang} labels={raceLabels.results} extraLabels={labels} botLevels={raceLabels.botLevels} highlightId={userId} />
          </>
        ) : <p role="status">{labels.loading}</p>}
        {room.hostId === userId ? <div className="flex flex-wrap gap-3">
          <Button disabled={pending || connection !== "connected"} onClick={() => void command(restartRace)}>{labels.restart}</Button>
          <Button variant="secondary" disabled={pending || connection !== "connected"} onClick={() => void command(closeRoom)}>{labels.close}</Button>
        </div> : <p>{labels.stay}</p>}
      </section>
    );
  }

  if (!race) return <p role="status">{labels.loading}</p>;
  return (
    <section className="flex flex-col gap-4" aria-label={raceLabels.leaderboard}>
      {room.status === "countdown" ? <>
        <h2 className="text-2xl font-bold">{raceLabels.headline.countdown}</h2>
        <p aria-live="assertive" aria-atomic="true" className="text-center text-6xl font-bold">{number.format(countdown)}</p>
      </> : <h2 className="text-2xl font-bold">{raceLabels.headline.racing}</h2>}
      {room.status === "countdown" ? <p className="break-words rounded-card border border-border bg-surface p-4 font-mono">{text}</p> : null}
      <RaceVisualizer racers={race.runners.map((r, index) => ({ id: r.id, name: r.kind === "bot" ? `${r.name} (${labels.bot}${r.level ? ` · ${raceLabels.botLevels[r.level]}` : ""})` : r.name, progress: r.progress * 100, isLocal: r.id === userId, hue: index * 47, bonusLabel: racerBonusLabel(race.bonusEvents, r.id, serverTime, raceLabels.bonuses) }))} />
      <ol className="flex flex-col gap-2">
        {race.runners.map((r) => <li key={r.id} className={`rounded-card border border-border p-3 ${r.id === userId ? "bg-accent-panel font-bold" : "bg-surface"}`}>
          {r.name} {r.kind === "bot" ? `(${labels.bot}${r.level ? ` · ${raceLabels.botLevels[r.level]}` : ""})` : ""} {r.id === userId ? `(${raceLabels.you})` : ""}
          {" · "}{number.format(r.position)} / {number.format(r.textLength)} {raceLabels.typing.characters}
          {" · "}{number.format(r.wpm)} {raceLabels.results.columns.wpm}
          {" · "}{percent.format(r.accuracy / 100)} {raceLabels.results.columns.accuracy}
        </li>)}
      </ol>
      {room.status === "racing" && active ? <>
        {physicalKeyboard ? connection === "connected" ? <RaceTypingPanel fog={(runner?.fogUntil ?? 0) > serverTime} bonusMessage={playerBonusMessage(race.bonusEvents, userId, serverTime, raceLabels.bonuses, race.runners)} locale={lang} labels={raceLabels.typing} text={text} typed={input.typed} correctChars={countCorrectChars(input.typed, text)} onChange={change} /> : <p role="status">{labels.reconnecting}</p> : <p>{labels.keyboard}</p>}
        {confirmAbandon ? <div role="group" aria-label={labels.confirmAbandon} className="flex flex-wrap items-center gap-3">
          <p>{labels.confirmAbandon}</p>
          <Button disabled={pending || connection !== "connected"} onClick={() => { buffer.clear(); void command(abandonRace).then(() => setConfirmAbandon(false)); }}>{labels.confirm}</Button>
          <Button variant="secondary" onClick={() => setConfirmAbandon(false)}>{labels.cancel}</Button>
        </div> : <Button variant="secondary" onClick={() => setConfirmAbandon(true)}>{raceLabels.abandon}</Button>}
      </> : null}
    </section>
  );
}
