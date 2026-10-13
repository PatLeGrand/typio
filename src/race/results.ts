import { botFinishMs, botKeystrokesAt, botProgressAt, type BotPlan } from "./bots";
import { computeAccuracy, computeWpm, type Keystrokes } from "./metrics";

/**
 * Classement final d'une course (A-D7, COURSE-3, COURSE-5, RES-1, RES-2). Module pur.
 * Tous les temps sont en ms depuis le départ, à l'instant où la course se termine pour le joueur.
 */
export type RacerStatus = "finished" | "unfinished" | "abandoned";

export interface PlayerOutcome {
  reason: "completed" | "timeout" | "abandoned";
  /** Durée de la course pour le joueur : départ -> dernière frappe juste, limite ou abandon. */
  elapsedMs: number;
  correctChars: number;
  keystrokes: Keystrokes;
}

export interface BotEntry {
  id: string;
  name: string;
  plan: BotPlan;
}

export interface RaceResultRow {
  id: string;
  name: string;
  isPlayer: boolean;
  rank: number;
  status: RacerStatus;
  wpm: number;
  accuracy: number;
  timeMs: number;
  correctChars: number;
}

type UnrankedRow = Omit<RaceResultRow, "rank">;

/** Ordre : arrivés (le plus rapide d'abord), puis non arrivés (le plus avancé d'abord), puis l'abandon. */
const STATUS_ORDER: Record<RacerStatus, number> = { finished: 0, unfinished: 1, abandoned: 2 };

function compareRows(a: UnrankedRow, b: UnrankedRow): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;
  if (a.status === "finished") return a.timeMs - b.timeMs;
  if (a.status === "unfinished") return b.correctChars - a.correctChars;
  return 0;
}

export function buildRaceResults(input: {
  textLength: number;
  playerId: string;
  playerName: string;
  player: PlayerOutcome;
  bots: readonly BotEntry[];
}): RaceResultRow[] {
  const { textLength, player, bots } = input;
  const endMs = player.elapsedMs;

  const playerStatus: RacerStatus =
    player.reason === "completed" ? "finished" : player.reason === "abandoned" ? "abandoned" : "unfinished";
  const rows: UnrankedRow[] = [
    {
      id: input.playerId,
      name: input.playerName,
      isPlayer: true,
      status: playerStatus,
      wpm: computeWpm(player.correctChars, endMs),
      accuracy: computeAccuracy(player.keystrokes),
      timeMs: endMs,
      correctChars: player.correctChars,
    },
  ];

  for (const bot of bots) {
    const finishMs = botFinishMs(bot.plan);
    const finished = finishMs <= endMs;
    const correctChars = finished ? textLength : botProgressAt(bot.plan, endMs);
    const timeMs = finished ? finishMs : endMs;
    rows.push({
      id: bot.id,
      name: bot.name,
      isPlayer: false,
      status: finished ? "finished" : "unfinished",
      wpm: computeWpm(correctChars, timeMs),
      accuracy: computeAccuracy(botKeystrokesAt(bot.plan, timeMs)),
      timeMs,
      correctChars,
    });
  }

  // Array#sort est stable : à égalité, le joueur (inséré en premier) passe devant.
  return rows.sort(compareRows).map((row, index) => ({ ...row, rank: index + 1 }));
}
