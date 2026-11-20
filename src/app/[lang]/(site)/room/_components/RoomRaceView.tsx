"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePhysicalKeyboard } from "@/components/race/usePhysicalKeyboard";
import { avatarUrl, runnerAvatar } from "@/components/avatar";
import { Button } from "@/components/Button";
import { ButtonLink } from "@/components/ButtonLink";
import { formatBotSuffix } from "@/components/race/formatRacerName";
import { playerBonusMessage, racerBonusLabel } from "@/components/race/bonusAnnouncements";
import { Flag, FlagTriangleRight, Gauge, Keyboard, ScanLine } from "lucide-react";
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

  const number = useMemo(() => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }), [lang]);
  const percent = useMemo(() => new Intl.NumberFormat(lang, { style: "percent" }), [lang]);
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
        <div role="status"><h2 ref={finishRef} tabIndex={-1} className={endReason ? "race-arrival" : "px-card text-2xl font-bold"}>{endReason ? raceLabels.headline[endReason] : raceLabels.results.tableTitle}</h2></div>
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
  const distance = runner?.progress ?? Math.max(0, ...race.runners.map((r) => r.progress));
  return (
    <section className="room-race-screen grid min-w-0 gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_19rem]" aria-label={raceLabels.leaderboard}>
      <div className="race-arena lg:col-span-2">
        <div className="race-timing-strip">
          <span className="race-mode"><FlagTriangleRight size={16} aria-hidden="true" />{room.solo ? raceLabels.solo : raceLabels.multiplayer}</span>
          <span className="mr-auto">{raceLabels.live}</span>
          {runner && <><span className="flex items-center gap-2"><Gauge size={16} aria-hidden="true" />{number.format(runner.wpm)} {raceLabels.results.columns.wpm}</span>
            <span className="flex items-center gap-2"><ScanLine size={16} aria-hidden="true" /><span className="max-sm:sr-only">{raceLabels.results.columns.accuracy} </span>{percent.format(runner.accuracy / 100)}</span></>}
        </div>
        <div className="race-panorama">
          {physicalKeyboard && <RaceVisualizer circuitLocale={lang} className="absolute inset-0" racers={race.runners.map((r, index) => ({ id: r.id, name: `${r.name}${formatBotSuffix(r.kind === "bot", r.level, labels.bot, raceLabels.botLevels)}`, progress: r.progress * 100, isLocal: r.id === userId, seed: runnerAvatar(r).seed, avatarName: r.name, avatarUrl: avatarUrl(r.kind === "human" ? r.id : undefined, r.avatarVersion), hue: index * 47, bonusLabel: racerBonusLabel(race.bonusEvents, r.id, serverTime, raceLabels.bonuses) }))} />}
          {room.status === "countdown" && <div className="race-start-signal">
            <h2>{raceLabels.headline.countdown}</h2>
            <p aria-live="assertive" aria-atomic="true">{number.format(countdown)}</p>
          </div>}
        </div>
        <div className="race-distance">
          <FlagTriangleRight size={16} aria-hidden="true" />
          <div className="race-ruler" aria-hidden="true">
            <span className="race-distance-fill" style={{ width: `${distance * 100}%` }} />
            {race.runners.map((r) => <i key={r.id} className={r.id === userId ? "race-pin race-pin-local" : "race-pin"} style={{ left: `${r.progress * 100}%` }} />)}
          </div>
          <Flag size={16} aria-hidden="true" />
          <span className="tabular-nums"><span className="sr-only">{runner ? raceLabels.distance : raceLabels.leadDistance} </span>{percent.format(distance)}</span>
        </div>
      </div>
      <div className={runner || room.status === "countdown" || race.finishDeadline != null ? "race-desk min-w-0 self-start" : "sr-only"}>
          {room.status === "racing" && <div role="status" className={endReason ? undefined : "sr-only"}><h2 ref={finishRef} tabIndex={-1} className={endReason ? "race-arrival" : "sr-only"}>{raceLabels.headline[endReason ?? "racing"]}</h2></div>}
          {room.status === "countdown" && <>
            <h2 className="race-desk-title"><Keyboard aria-hidden="true" />{raceLabels.typing.title}</h2>
            <p className="race-passage">{text}</p>
          </>}
          {room.status === "racing" && race.finishDeadline != null && <p role="timer" className="tabular-nums">
            {labels.finishCountdown.replace("{time}", formatClock(Math.max(0, race.finishDeadline - serverTime), "ceil"))}
          </p>}
          {room.status === "racing" && active ? <>
            {physicalKeyboard ? connection === "connected" ? <RaceTypingPanel embedded focusRef={typingRef} fog={(runner?.fogUntil ?? 0) > serverTime} bonusMessage={playerBonusMessage(race.bonusEvents, userId, serverTime, raceLabels.bonuses, race.runners)} locale={lang} labels={raceLabels.typing} text={text} typed={input.typed} correctChars={countCorrectChars(input.typed, text)} onChange={change} /> : <p role="status">{labels.reconnecting}</p> : <p className="flex items-center gap-3 font-semibold"><Keyboard className="shrink-0 text-accent-text" aria-hidden="true" />{labels.keyboard}</p>}
            {confirmAbandon ? <div role="group" aria-label={labels.confirmAbandon} className="flex flex-wrap items-center gap-3">
              <p>{labels.confirmAbandon}</p>
              <Button disabled={pending || connection !== "connected"} onClick={() => { buffer.clear(); void command(abandonRace).then(() => setConfirmAbandon(false)); }}>{labels.confirm}</Button>
              <Button autoFocus variant="secondary" onClick={() => { setFocusAbandon(!typingRef.current); setConfirmAbandon(false); typingRef.current?.focus(); }}>{labels.cancel}</Button>
            </div> : <Button className="self-start" autoFocus={focusAbandon} variant="secondary" onClick={() => { setFocusAbandon(false); setConfirmAbandon(true); }}>{raceLabels.abandon}</Button>}
          </> : null}
      </div>
      <RoomRaceSidebar runners={race.runners} userId={userId} lang={lang} code={room.solo ? undefined : room.code} codeLabels={codeLabels} labels={labels} raceLabels={raceLabels} />
    </section>
  );
}
