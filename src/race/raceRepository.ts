import type { races, raceResults } from "@/db/schema";

export type NewRace = typeof races.$inferInsert;
export type NewRaceResult = Omit<typeof raceResults.$inferInsert, "id" | "raceId" | "createdAt" | "personalBest">;

/** Écriture unique de la course et des résultats de ses membres (RES-05, PERF-02). */
export interface RaceRepository {
  recordRace(race: NewRace, rows: NewRaceResult[]): Promise<string[]>;
}
