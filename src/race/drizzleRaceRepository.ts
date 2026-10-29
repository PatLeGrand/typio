import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { races, raceResults } from "@/db/schema";
import type { RaceRepository } from "./raceRepository";

export function createDrizzleRaceRepository(db: PostgresJsDatabase): RaceRepository {
  return {
    async recordRace(race, rows) {
      await db.transaction(async (tx) => {
        const [saved] = await tx.insert(races).values(race).returning({ id: races.id });
        if (rows.length) {
          await tx.insert(raceResults).values(rows.map((row) => ({ ...row, raceId: saved.id })));
        }
      });
    },
  };
}
