import { botFinishMs, botKeystrokesAt, botProgressAt, botWpmSeries, planBot, replanBot, BOT_FOG_SLOWDOWN_FACTOR, type BotPlan } from "@/race/bots";
import { applyTextEdits, crossedCheckpoints, resolveCheckpoint, type BonusAward, type TextEdit } from "@/race/bonuses";
import { getEffectiveTimeLimitSeconds } from "@/race/config";
import { COUNTDOWN_MS } from "@/race/lifecycle";
import { applyTypedInput, computeAccuracy, computeWpm, countCorrectChars, type Keystrokes } from "@/race/metrics";
import { createSeededRandom, shuffled } from "@/race/seededRandom";
import { generateRaceText } from "@/race/textGenerator";
import fr from "@/i18n/dictionaries/fr.json";
import en from "@/i18n/dictionaries/en.json";
import type { BotLevel, RoomConfig, RoomErrorCode, RoomState } from "./protocol";

export type RunnerStatus = "ready" | "typing" | "finished" | "abandoned";

export interface RaceRunner {
  id: string;
  name: string;
  kind: "human" | "bot";
  status: RunnerStatus;
  connected: boolean;
  typed: string;
  edits: TextEdit[];
  bonusesReceived: number;
  fogUntil: number | null;
  position: number;
  keystrokes: Keystrokes;
  /** Compte toutes les opérations acceptées, retours arrière compris (COURSE-06). */
  inputCount: number;
  lastActivityAt: number;
  finishedAt: number | null;
  abandonedAt: number | null;
  wpmSeries: number[];
  missedKeys?: Record<string, number>;
  userKind?: "member" | "guest";
  plan?: BotPlan;
  level?: BotLevel;
}

export interface RaceState {
  status: "countdown" | "racing" | "results";
  hostId: string;
  config: RoomConfig;
  text: string;
  seed: number;
  checkpointsTriggered: number;
  bonusEvents: (BonusAward & { at: number })[];
  startAt: number;
  timeLimitMs: number;
  endedAt: number | null;
  runners: RaceRunner[];
}

export type RaceResult =
  | { ok: true; state: RaceState }
  | { ok: false; state: RaceState; error: RoomErrorCode };

const active = (runner: RaceRunner) => runner.status === "ready" || runner.status === "typing";

export function startRace(
  room: RoomState, userId: string, now: number, seed: number,
): { ok: true; state: RaceState } | { ok: false; error: RoomErrorCode } {
  if (room.status !== "waiting") return { ok: false, error: "RACE_NOT_ALLOWED" };
  if (room.hostId !== userId) return { ok: false, error: "NOT_HOST" };
  if (!room.participants.some((p) => p.userId === userId && p.connected)) {
    return { ok: false, error: "RACE_NOT_ALLOWED" };
  }
  const humans = room.participants.filter((p) => p.role === "runner");
  if (humans.length === 0 || humans.length + room.config.bots.length < 2) {
    return { ok: false, error: "NOT_ENOUGH_RUNNERS" };
  }
  const random = createSeededRandom(seed);
  const generated = generateRaceText(room.config, random);
  if (!generated.ok) return generated;
  const names = shuffled((room.config.language === "fr" ? fr : en).raceScreen.botNames, random);
  const runner = (id: string, name: string, kind: RaceRunner["kind"], connected: boolean): RaceRunner => ({
    id, name, kind, connected, status: "ready", typed: "", position: 0,
    keystrokes: { total: 0, correct: 0 }, inputCount: 0, lastActivityAt: now,
    finishedAt: null, abandonedAt: null, wpmSeries: [],
    edits: [], bonusesReceived: 0, fogUntil: null,
    ...(kind === "human" ? { missedKeys: {} } : {}),
  });
  return {
    ok: true,
    state: {
      status: "countdown", hostId: room.hostId, config: { ...room.config }, text: generated.text,
      seed, checkpointsTriggered: 0, bonusEvents: [],
      startAt: now + COUNTDOWN_MS,
      timeLimitMs: getEffectiveTimeLimitSeconds(room.config) * 1000,
      endedAt: null,
      runners: [
        ...humans.map((p) => ({ ...runner(p.userId, p.displayName, "human", p.connected), userKind: p.kind })),
        ...room.config.bots.map((level, index) => ({
          ...runner(`bot-${index}`, names[index % names.length], "bot", true),
          level,
          plan: planBot(generated.text, level, room.config.inputMode, random),
        })),
      ],
    },
  };
}

/** Aucun lot refusé n’est appliqué, même partiellement ; seul le temps avance. */
export function applyInput(race: RaceState, userId: string, ops: readonly string[], now: number): RaceResult {
  race = tickRace(race, now);
  if (race.status !== "racing" || now < race.startAt || now >= race.startAt + race.timeLimitMs) {
    return { ok: false, state: race, error: "RACE_NOT_RUNNING" };
  }
  const runner = race.runners.find((r) => r.id === userId && r.kind === "human");
  if (!runner || !active(runner) || !runner.connected || now < runner.lastActivityAt ||
    ops.length > 64 || ops.some((op) => typeof op !== "string" || op.length !== 1) ||
    runner.inputCount + ops.length > 25 * ((now - race.startAt) / 1000) + 15) {
    return { ok: false, state: race, error: "INPUT_REJECTED" };
  }
  const text = applyTextEdits(race.text, runner.edits);
  let updated = { ...runner };
  for (const op of ops) {
    const next = op === "\b" ? updated.typed.slice(0, -1) : updated.typed + op;
    const input = applyTypedInput(updated.typed, next, text, race.config.inputMode, updated.keystrokes, updated.missedKeys);
    updated = { ...updated, ...input, inputCount: updated.inputCount + 1, lastActivityAt: now, status: "typing" };
    updated.position = countCorrectChars(updated.typed, text);
    if (updated.typed === text) {
      updated.status = "finished";
      updated.finishedAt = now;
      break;
    }
  }
  return { ok: true, state: tickRace({ ...race, runners: race.runners.map((r) => r === runner ? updated : r) }, now) };
}

export function abandonRace(race: RaceState, userId: string, now: number): RaceState {
  const current = tickRace(race, now);
  if (current.status === "results") return current;
  return tickRace({
    ...current,
    runners: current.runners.map((r) => r.id === userId && r.kind === "human" && active(r)
      ? { ...r, status: "abandoned", abandonedAt: now, lastActivityAt: now } : r),
  }, now);
}

export function setRunnerConnected(race: RaceState, userId: string, connected: boolean, now: number): RaceState {
  const current = tickRace(race, now);
  if (current.status === "results") return current;
  return {
    ...current,
    runners: current.runners.map((r) => r.id === userId && r.kind === "human" && active(r)
      ? { ...r, connected, lastActivityAt: now } : r),
  };
}

/** L’appelant gère la grâce de 30 s ; une expiration après reconnexion est ignorée. */
export function expireRunner(race: RaceState, userId: string, now: number): RaceState {
  const runner = race.runners.find((r) => r.id === userId);
  return runner && !runner.connected ? abandonRace(race, userId, now) : tickRace(race, now);
}

export function tickRace(race: RaceState, now: number): RaceState {
  if (race.status === "results" || now < race.startAt) return race;
  const deadline = race.startAt + race.timeLimitMs;
  const elapsedMs = Math.min(now, deadline) - race.startAt;
  let runners = race.runners.map((r): RaceRunner => {
    if (r.kind === "human") {
      // Indice = seconde depuis le départ ; les ticks tardifs complètent les secondes manquantes.
      const count = Math.min(601, Math.floor(race.timeLimitMs / 1000) + 1,
        Math.floor(elapsed(race, r, now) / 1000) + 1);
      if (r.wpmSeries.length >= count) return r;
      const wpmSeries = [...r.wpmSeries];
      while (wpmSeries.length < count) {
        wpmSeries.push(computeWpm(r.position, wpmSeries.length * 1000));
      }
      return { ...r, wpmSeries };
    }
    if (!r.plan || !active(r)) return r;
    const finished = elapsedMs >= botFinishMs(r.plan);
    return {
      ...r, position: botProgressAt(r.plan, elapsedMs), keystrokes: botKeystrokesAt(r.plan, elapsedMs),
      status: finished ? "finished" : "typing",
      finishedAt: finished ? race.startAt + botFinishMs(r.plan) : null,
    };
  });
  let checkpointsTriggered = race.checkpointsTriggered;
  const bonusEvents = [...race.bonusEvents];
  if (race.config.bonuses && now < deadline) {
    const maxProgress = Math.max(...runners.filter((r) => r.status !== "abandoned")
      .map((r) => r.position / applyTextEdits(race.text, r.edits).length));
    for (const checkpoint of crossedCheckpoints(maxProgress, checkpointsTriggered)) {
      const random = createSeededRandom(race.seed + Math.imul(checkpoint + 1, 0x9e3779b9));
      const awards = resolveCheckpoint(checkpoint, runners.map((r) => {
        const text = applyTextEdits(race.text, r.edits);
        return {
          id: r.id, active: active(r), progress: r.position / text.length,
          typedLength: r.kind === "bot" ? r.position : r.typed.length, text,
          bonusesReceived: r.bonusesReceived, fogUntilMs: r.fogUntil ?? 0,
        };
      }), now, random, (count) => {
        const generated = generateRaceText({ ...race.config, textMode: "words" }, random);
        const words = (generated.ok ? generated.text : race.text).split(/\s+/u);
        return Array.from({ length: count }, () => words[Math.floor(random() * words.length)]);
      });
      for (const award of awards) {
        bonusEvents.push({ ...award, at: now });
        runners = runners.map((r) => {
          if (r.id !== award.recipientId && r.id !== award.targetId) return r;
          const updated = { ...r, bonusesReceived: r.bonusesReceived + (r.id === award.recipientId ? 1 : 0) };
          if (r.id === award.targetId) {
            if (award.edit) updated.edits = [...r.edits, award.edit];
            if (award.fogUntilMs !== undefined) updated.fogUntil = award.fogUntilMs;
            if (r.plan && r.level) {
              updated.plan = replanBot(r.plan, elapsedMs, applyTextEdits(race.text, updated.edits),
                r.level, race.config.inputMode, random,
                { untilMs: (updated.fogUntil ?? 0) - race.startAt, factor: BOT_FOG_SLOWDOWN_FACTOR });
            }
          }
          return updated;
        });
      }
      checkpointsTriggered = checkpoint + 1;
    }
  }
  const allDone = runners.every((r) => !active(r));
  const endedAt = allDone
    ? Math.max(race.startAt, ...runners.map((r) => r.finishedAt ?? r.abandonedAt ?? race.startAt))
    : now >= deadline ? deadline : null;
  return { ...race, runners, checkpointsTriggered, bonusEvents, status: endedAt === null ? "racing" : "results", endedAt };
}

function elapsed(race: RaceState, runner: RaceRunner, now: number): number {
  return Math.max(0, Math.min(runner.finishedAt ?? runner.abandonedAt ?? race.endedAt ?? now,
    race.startAt + race.timeLimitMs) - race.startAt);
}

export function raceSnapshot(race: RaceState, now: number) {
  const current = tickRace(race, now);
  return {
    status: current.status, serverNow: now, startAt: current.startAt, text: current.text,
    bonusEvents: current.bonusEvents.filter((event) => event.at >= now - 10_000),
    runners: current.runners.map((r) => ({
      id: r.id, name: r.name, kind: r.kind, ...(r.kind === "bot" ? { level: r.level } : {}), status: r.status, connected: r.connected,
      position: r.position, progress: r.position / applyTextEdits(current.text, r.edits).length,
      edits: r.edits, fogUntil: r.fogUntil, textLength: applyTextEdits(current.text, r.edits).length,
      wpm: computeWpm(r.position, elapsed(current, r, now)), accuracy: computeAccuracy(r.keystrokes),
    })),
  };
}

/** Classement disponible après la fin ; les égalités gardent l’ordre de la salle. */
export function raceResults(race: RaceState) {
  const endedAt = race.endedAt;
  if (endedAt === null) return null;
  const order = { finished: 0, unfinished: 1, abandoned: 2 };
  return race.runners.map((r) => {
    const timeMs = elapsed(race, r, endedAt);
    return {
      id: r.id, name: r.name, kind: r.kind, ...(r.kind === "bot" ? { level: r.level } : {}),
      status: r.status === "finished" ? "finished" as const : r.status === "abandoned" ? "abandoned" as const : "unfinished" as const,
      position: r.position, progress: r.position / applyTextEdits(race.text, r.edits).length,
      bonusesReceived: r.bonusesReceived,
      bonusTypes: race.bonusEvents.filter((event) => event.recipientId === r.id).map((event) => event.type),
      wpm: computeWpm(r.position, timeMs), grossWpm: computeWpm(r.keystrokes.total, timeMs),
      wpmSeries: r.kind === "bot" && r.plan ? botWpmSeries(r.plan, timeMs) : r.wpmSeries,
      ...(r.kind === "human" ? { missedKeys: r.missedKeys ?? {} } : {}),
      accuracy: computeAccuracy(r.keystrokes), errors: r.keystrokes.total - r.keystrokes.correct, timeMs,
    };
  }).sort((a, b) => order[a.status] - order[b.status] ||
    (a.status === "finished" ? a.timeMs - b.timeMs : b.progress - a.progress))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Données privées réservées au dépôt ; aucune saisie ni identité d'invité. */
export function raceResultRows(race: RaceState) {
  return raceResults(race)?.flatMap((row) => {
    const runner = race.runners.find((r) => r.id === row.id)!;
    if (runner.kind !== "human" || runner.userKind !== "member") return [];
    return [{
      userId: row.id, rank: row.rank, status: row.status, wpm: row.wpm,
      grossWpm: row.grossWpm, accuracy: row.accuracy, errors: row.errors,
      durationMs: row.timeMs, progress: row.progress, wpmSeries: [...runner.wpmSeries],
      missedKeys: { ...runner.missedKeys },
    }];
  }) ?? [];
}
