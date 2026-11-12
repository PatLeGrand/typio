import type { BonusType } from "./bonuses";
import type { BotLevel } from "@/realtime/protocol";

/**
 * Classement final d'une course (A-D7, COURSE-09, COURSE-07, RES-01, RES-02). Module pur.
 * Tous les temps sont en ms depuis le départ, à l'instant où la course se termine pour le joueur.
 */
export type RacerStatus = "finished" | "unfinished" | "abandoned";

export interface RaceResultRow {
  id: string;
  name: string;
  isPlayer: boolean;
  level?: BotLevel;
  rank: number;
  status: RacerStatus;
  wpm: number;
  wpmSeries: number[];
  missedKeys?: Record<string, number>;
  accuracy: number;
  timeMs: number;
  correctChars: number;
  progress: number;
  bonusesReceived?: number;
  bonusTypes?: BonusType[];
}
