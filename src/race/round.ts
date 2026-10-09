import { botProgressAt, planBot } from "./bots";
import type { RaceSettings } from "./config";
import { computeAccuracy, computeWpm, countCorrectChars } from "./metrics";
import { buildRaceResults, type BotEntry, type RaceResultRow } from "./results";
import {
  createRaceSession,
  getPlayerOutcome,
  raceElapsedMs,
  raceTimeLeftMs,
  type RaceSession,
} from "./session";

/**
 * Une manche solo : la session du joueur et les bots qui courent contre lui (BOT-2, BOT-3).
 * Module pur : `now` et `random` sont fournis par l'appelant.
 */
export interface Round {
  id: number;
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
  now: number,
  random: () => number,
): Round {
  const bots = Array.from({ length: settings.botCount }, (_, index): BotEntry => ({
    id: `bot-${index}`,
    name: botNames[index % botNames.length],
    plan: planBot(text, settings.botDifficulty, random),
  }));
  return { id, session: createRaceSession(settings, text, now), bots };
}

export interface RacerSnapshot {
  id: string;
  name: string;
  isPlayer: boolean;
  /** Avancement sur le texte, de 0 à 100. */
  progress: number;
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
    ? buildRaceResults({ textLength: text.length, playerId: PLAYER_ID, playerName, player: outcome, bots })
    : null;

  const live: RacerSnapshot[] = [
    { id: PLAYER_ID, name: playerName, isPlayer: true, progress: progressOf(playerChars, text.length) },
    ...bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      isPlayer: false,
      progress: progressOf(botProgressAt(bot.plan, elapsedMs), text.length),
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
