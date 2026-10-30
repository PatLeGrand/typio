import type { BotLevel } from "@/realtime/protocol";
import { BOT_FOG_SLOWDOWN_FACTOR, botProgressAt, planBot, replanBot } from "./bots";
import { applyTextEdits, crossedCheckpoints, resolveCheckpoint, type BonusAward } from "./bonuses";
import { generateRaceText } from "./textGenerator";
import type { RaceSettings } from "./config";
import { computeAccuracy, computeWpm, countCorrectChars } from "./metrics";
import { createSeededRandom, shuffled } from "./seededRandom";
import { buildRaceResults, type BotEntry, type RaceResultRow } from "./results";
import {
  createRaceSession,
  getPlayerOutcome,
  raceElapsedMs,
  raceTimeLeftMs,
  type RaceSession,
} from "./session";

/**
 * Une manche solo : la session du joueur et les bots qui courent contre lui (BOT-02, BOT-03, COURSE-02).
 * Module pur : `now` et `random` sont fournis par l'appelant.
 */
export interface Round {
  id: number;
  seed: number;
  checkpointsTriggered: number;
  bonusEvents: (BonusAward & { at: number })[];
  texts: Record<string, string>;
  fogUntil: Record<string, number>;
  session: RaceSession;
  bots: readonly BotEntry[];
}

export const PLAYER_ID = "player";
/** Avant cette durée la MPM en direct n'a pas de sens (une seule frappe donnerait 100 MPM ou plus). */
const MIN_LIVE_WPM_MS = 1_000;

export function createRound(
  id: number,
  settings: RaceSettings,
  text: string,
  botNames: readonly string[],
  /** Graine des noms : le serveur et le navigateur tirent ainsi les mêmes (hydratation). */
  nameSeed: number,
  now: number,
  random: () => number,
): Round {
  const names = shuffled(botNames, createSeededRandom(nameSeed));
  const bots = settings.bots.map((level, index): BotEntry => ({
    id: `bot-${index}`,
    name: names[index % names.length],
    level,
    plan: planBot(text, level, settings.inputMode, random),
  }));
  return { id, seed: nameSeed, checkpointsTriggered: 0, bonusEvents: [],
    texts: Object.fromEntries([PLAYER_ID, ...bots.map((bot) => bot.id)].map((id) => [id, text])),
    fogUntil: {}, session: createRaceSession(settings, text, now), bots };
}

/** Traite chaque point une seule fois ; tout le hasard dépend de la graine de la manche. */
export function applyRoundBonuses(round: Round, now: number): Round {
  const { session } = round;
  const settings = session.lifecycle.settings;
  if (!settings.bonuses || session.lifecycle.phase !== "racing" || now >= session.lifecycle.endsAt) return round;
  const startsAt = session.lifecycle.startsAt;
  const elapsedMs = raceElapsedMs(session, now);
  let current = round;
  const runners = () => [PLAYER_ID, ...current.bots.map((bot) => bot.id)].map((id) => {
    const text = current.texts[id];
    const bot = current.bots.find((bot) => bot.id === id);
    const position = bot ? botProgressAt(bot.plan, elapsedMs) : countCorrectChars(session.typed, text);
    return { id, text, active: position < text.length, progress: position / text.length,
      typedLength: bot ? position : session.typed.length,
      bonusesReceived: current.bonusEvents.filter((event) => event.recipientId === id).length,
      fogUntilMs: current.fogUntil[id] ?? 0 };
  });
  for (const checkpoint of crossedCheckpoints(Math.max(...runners().map((r) => r.progress)), round.checkpointsTriggered)) {
    const random = createSeededRandom(round.seed + Math.imul(checkpoint + 1, 0x9e3779b9));
    const awards = resolveCheckpoint(checkpoint, runners(), now, random, (count) => {
      const generated = generateRaceText({ ...settings, textMode: "words" }, random);
      const words = (generated.ok ? generated.text : session.text).split(/\s+/u);
      return Array.from({ length: count }, () => words[Math.floor(random() * words.length)]);
    });
    for (const award of awards) {
      const text = award.edit ? applyTextEdits(current.texts[award.targetId], [award.edit]) : current.texts[award.targetId];
      const fogUntil = { ...current.fogUntil, [award.targetId]: award.fogUntilMs ?? current.fogUntil[award.targetId] ?? 0 };
      current = { ...current, texts: { ...current.texts, [award.targetId]: text }, fogUntil,
        bonusEvents: [...current.bonusEvents, { ...award, at: now }],
        session: award.targetId === PLAYER_ID ? { ...current.session, text } : current.session,
        bots: current.bots.map((bot) => bot.id === award.targetId && bot.level ? { ...bot,
          plan: replanBot(bot.plan, elapsedMs, text, bot.level, settings.inputMode, random,
            { untilMs: fogUntil[bot.id] - startsAt, factor: BOT_FOG_SLOWDOWN_FACTOR }) } : bot) };
    }
    current = { ...current, checkpointsTriggered: checkpoint + 1 };
  }
  return current;
}

export interface RacerSnapshot {
  id: string;
  name: string;
  isPlayer: boolean;
  /** Avancement sur le texte, de 0 à 100. */
  progress: number;
  level?: BotLevel;
}

export interface RoundSnapshot {
  phase: "countdown" | "racing" | "results";
  /** Chiffre du compte à rebours (3, 2, 1), ou 0 hors compte à rebours. */
  countdownSeconds: number;
  elapsedMs: number;
  timeLeftMs: number;
  wpm: number;
  accuracy: number;
  /** Classement courant (par avancement) ; celui des résultats une fois la course finie. */
  racers: RacerSnapshot[];
  playerRank: number;
  results: RaceResultRow[] | null;
  endReason: "completed" | "timeout" | "abandoned" | null;
}

const progressOf = (chars: number, total: number) => (total === 0 ? 0 : Math.min(100, (chars / total) * 100));

export function snapshotRound(round: Round, clock: number, playerName: string): RoundSnapshot {
  const { session, bots } = round;
  const { lifecycle, text } = session;
  const phase = lifecycle.phase === "results" ? "results" : lifecycle.phase === "racing" ? "racing" : "countdown";
  const elapsedMs = raceElapsedMs(session, clock);
  const playerChars = countCorrectChars(session.typed, text);

  const outcome = getPlayerOutcome(session);
  const results = outcome
    ? buildRaceResults({ playerId: PLAYER_ID, playerName, player: outcome, bots }).map((row) => ({ ...row,
      bonusesReceived: round.bonusEvents.filter((event) => event.recipientId === row.id).length,
      bonusTypes: round.bonusEvents.filter((event) => event.recipientId === row.id).map((event) => event.type),
    }))
    : null;

  const live: RacerSnapshot[] = [
    { id: PLAYER_ID, name: playerName, isPlayer: true, progress: progressOf(playerChars, text.length) },
    ...bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      isPlayer: false,
      level: bot.level,
      progress: progressOf(botProgressAt(bot.plan, elapsedMs), bot.plan.textLength),
    })),
  ];
  // Tri stable : à égalité d'avancement, le joueur reste devant.
  const racers = results
    ? results.map((row) => live.find((racer) => racer.id === row.id) ?? live[0])
    : [...live].sort((a, b) => b.progress - a.progress);
  const playerRow = results?.find((row) => row.isPlayer);

  return {
    phase,
    countdownSeconds:
      lifecycle.phase === "countdown" ? Math.max(1, Math.ceil((lifecycle.startsAt - clock) / 1000)) : 0,
    elapsedMs,
    timeLeftMs: raceTimeLeftMs(session, clock),
    wpm: playerRow?.wpm ?? (elapsedMs >= MIN_LIVE_WPM_MS ? computeWpm(playerChars, elapsedMs) : 0),
    accuracy: computeAccuracy(session.keystrokes),
    racers,
    playerRank: racers.findIndex((racer) => racer.isPlayer) + 1,
    results,
    endReason: outcome?.reason ?? null,
  };
}
