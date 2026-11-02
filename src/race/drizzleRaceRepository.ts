import { and, eq, max, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { races, raceResults, users } from "@/db/schema";
import type { RaceRepository } from "./raceRepository";

export function createDrizzleRaceRepository(db: PostgresJsDatabase): RaceRepository {
  return {
    async recordRace(race, rows) {
      return db.transaction(async (tx) => {
        // Ordre stable des verrous : deux enregistrements concurrents restent sérialisés par membre.
        for (const userId of [...new Set(rows.map((row) => row.userId))].sort()) {
          await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("no key update");
        }
        const records: string[] = [];
        const results = [];
        for (const row of rows) {
          const [previous] = await tx.select({ wpm: max(raceResults.wpm) }).from(raceResults)
            .where(and(eq(raceResults.userId, row.userId), ne(raceResults.status, "abandoned")));
          const personalBest = row.status !== "abandoned" && previous.wpm !== null && row.wpm > previous.wpm;
          if (personalBest) records.push(row.userId);
          results.push({ ...row, personalBest });
        }
        const [saved] = await tx.insert(races).values(race).returning({ id: races.id });
        if (rows.length) {
          await tx.insert(raceResults).values(results.map((row) => ({ ...row, raceId: saved.id })));
        }
        return records;
      });
    },
  };
}
