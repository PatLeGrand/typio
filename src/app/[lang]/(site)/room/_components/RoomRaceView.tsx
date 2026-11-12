"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";
import { avatarUrl, runnerAvatar } from "@/components/avatar";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { formatBotSuffix } from "@/components/race/formatRacerName";
import { playerBonusMessage, racerBonusLabel } from "@/components/race/bonusAnnouncements";
import { RaceInputCard } from "@/components/race/RaceInputCard";
import { RaceTypingPanel } from "@/components/race/RaceTypingPanel";
import { RaceVisualizer } from "@/components/race/RaceVisualizer";
import type { Dictionary } from "@/i18n/dictionaries";
import { formatClock } from "@/race/format";
import { serializeRaceSettings } from "@/race/config";
import { applyTextEdits } from "@/race/bonuses";
import { applyTypedInput, countCorrectChars } from "@/race/metrics";
import { createRaceInputBuffer, raceInputOps } from "@/realtime/raceInput";
import { getSocket } from "@/realtime/client";
import type { RoomState } from "@/realtime/protocol";
import type { UseRoom } from "@/realtime/useRoom";
import { RoomRaceSidebar } from "./RoomRaceSidebar";
import { RoomRaceResultsContent } from "./RoomRaceResultsContent";

type Props = {
  room: RoomState;
  userId: string;
  lang: string;
  labels: Dictionary["room"]["race"];
  codeLabels: Dictionary["room"]["code"];
  raceLabels: Dictionary["raceScreen"];
  session: Pick<UseRoom, "race" | "results" | "self" | "raceReceivedAt" | "connection" | "sendInput" | "abandonRace" | "restartRace" | "startRace" | "closeRoom">;
};

/** Saisie optimiste ; piste et classement restent entièrement pilotés par le serveur. */
export function RoomRaceView({ room, userId, lang, labels, codeLabels, raceLabels, session }: Props) {
  const { race, results, self, raceReceivedAt, connection, sendInput, abandonRace, restartRace, startRace, closeRoom } = session;
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
  const typingRef = useRef<HTMLInputElement>(null);
  const finishRef = useRef<HTMLHeadingElement>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [focusAbandon, setFocusAbandon] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const physicalKeyboard = usePhysicalKeyboard();
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
  const runner = race?.runners.find((r) => r.id === userId && r.kind === "human");
  const text = race ? applyTextEdits(race.text, runner?.edits ?? []) : "";
  const active = runner?.status === "ready" || runner?.status === "typing";
  const endReason = runner?.status === "finished" ? "completed"
    : runner?.status === "abandoned" ? (runner.connected ? "abandoned" : "timeout")
    : runner && room.status === "results" ? "timeout" : null;
  useEffect(() => {
    if (endReason) finishRef.current?.focus();
  }, [endReason]);
  const serverTime = race ? race.serverNow + Math.max(0, (now ?? raceReceivedAt ?? 0) - (raceReceivedAt ?? 0)) : 0;
  const countdown = race ? Math.min(3, Math.max(1, Math.ceil((race.startAt - serverTime) / 1000))) : 3;

  async function command(action: () => Promise<unknown>) {
    setPending(true);
    try { await action(); } finally { setPending(false); }
  }

  async function replaySolo() {
    if (room.status !== "waiting") {
      const result = await restartRace();
      if (!result.ok) return;
    }
    await startRace();
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

  if (room.status === "results" || (room.solo && room.status === "waiting")) {
    return (
      <section className="flex flex-col gap-4" aria-label={raceLabels.results.tableTitle}>
        <div role="status"><h2 ref={finishRef} tabIndex={-1} className="px-card text-2xl font-bold focus-visible:outline-none">{endReason ? raceLabels.headline[endReason] : raceLabels.results.tableTitle}</h2></div>
        {records.includes(userId) && <p role="status" className="px-card">{raceLabels.results.newPersonalBest}</p>}
        {results ? (
          <RoomRaceResultsContent results={results} self={self} records={records} userId={userId} lang={lang} labels={labels} raceLabels={raceLabels} />
        ) : room.status === "results" ? <p role="status">{labels.loading}</p> : null}
        {room.hostId === userId ? <div className="flex flex-wrap gap-3">
          {room.solo ? <>
            <Button variant="start" disabled={pending || connection !== "connected"} onClick={() => void command(replaySolo)}>{labels.soloReplay}</Button>
            <ButtonLink variant="secondary" href={`/${lang}/race/settings?${serializeRaceSettings(room.config)}`}>{labels.soloSettings}</ButtonLink>
          </> : <>
            <Button variant="start" disabled={pending || connection !== "connected"} onClick={() => void command(restartRace)}>{labels.restart}</Button>
            <Button variant="secondary" disabled={pending || connection !== "connected"} onClick={() => void command(closeRoom)}>{labels.close}</Button>
          </>}
        </div> : <p>{labels.stay}</p>}
      </section>
    );
  }

  if (!race) return <p role="status">{labels.loading}</p>;
  return (
    <section className="room-race-screen relative -mx-4 [--race-track-height:260px] sm:[--race-track-height:320px] md:-mx-8 lg:[--race-track-height:420px]" aria-label={raceLabels.leaderboard}>
      <RaceVisualizer paused={!physicalKeyboard} className="relative h-[var(--race-track-height)] w-full overflow-hidden" racers={race.runners.map((r, index) => ({ id: r.id, name: `${r.name}${formatBotSuffix(r.kind === "bot", r.level, labels.bot, raceLabels.botLevels)}`, progress: r.progress * 100, isLocal: r.id === userId, seed: runnerAvatar(r).seed, avatarName: r.name, avatarUrl: avatarUrl(r.kind === "human" ? r.id : undefined, r.avatarVersion), hue: index * 47, bonusLabel: racerBonusLabel(race.bonusEvents, r.id, serverTime, raceLabels.bonuses) }))} />
      <div className="relative z-10 mx-auto -mt-5 max-w-[960px] px-4 sm:px-8">
        <RaceInputCard className="flex flex-col items-stretch gap-4">
          {room.status === "countdown" ? <>
            <h2 className="text-lg font-bold text-balance">{raceLabels.headline.countdown}</h2>
            <p aria-live="assertive" aria-atomic="true" className="text-center text-6xl font-bold tabular-nums">{number.format(countdown)}</p>
          </> : <div role="status"><h2 ref={finishRef} tabIndex={-1} className={`${endReason ? "" : "sr-only "}text-lg font-bold text-balance focus-visible:outline-none`}>{raceLabels.headline[endReason ?? "racing"]}</h2></div>}
          {room.status === "countdown" ? <p className="break-words whitespace-pre-wrap font-mono text-base leading-relaxed">{text}</p> : null}
          {room.status === "racing" && race.finishDeadline != null && <p role="timer" className="tabular-nums">
            {labels.finishCountdown.replace("{time}", formatClock(Math.max(0, race.finishDeadline - serverTime), "ceil"))}
          </p>}
          {room.status === "racing" && active ? <>
            {physicalKeyboard ? connection === "connected" ? <RaceTypingPanel embedded focusRef={typingRef} fog={(runner?.fogUntil ?? 0) > serverTime} bonusMessage={playerBonusMessage(race.bonusEvents, userId, serverTime, raceLabels.bonuses, race.runners)} locale={lang} labels={raceLabels.typing} text={text} typed={input.typed} correctChars={countCorrectChars(input.typed, text)} onChange={change} /> : <p role="status">{labels.reconnecting}</p> : <p>{labels.keyboard}</p>}
            {confirmAbandon ? <div role="group" aria-label={labels.confirmAbandon} className="flex flex-wrap items-center gap-3">
              <p>{labels.confirmAbandon}</p>
              <Button disabled={pending || connection !== "connected"} onClick={() => { buffer.clear(); void command(abandonRace).then(() => setConfirmAbandon(false)); }}>{labels.confirm}</Button>
              <Button autoFocus variant="secondary" onClick={() => { setFocusAbandon(!typingRef.current); setConfirmAbandon(false); typingRef.current?.focus(); }}>{labels.cancel}</Button>
            </div> : <Button className="self-start" autoFocus={focusAbandon} variant="secondary" onClick={() => { setFocusAbandon(false); setConfirmAbandon(true); }}>{raceLabels.abandon}</Button>}
          </> : null}
        </RaceInputCard>
      </div>
      <RoomRaceSidebar runners={race.runners} userId={userId} lang={lang} code={room.solo ? undefined : room.code} codeLabels={codeLabels} labels={labels} raceLabels={raceLabels} />
    </section>
  );
}
