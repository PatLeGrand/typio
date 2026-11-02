import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { races, raceResults } from "@/db/schema";

export function createDrizzleProfileStatsRepository(db: PostgresJsDatabase) {
  return {
    async getUserStats(userId: string) {
      const [stats] = await db.select({
        raceCount: sql<number>`count(*)`.mapWith(Number),
        wins: sql<number>`count(*) filter (where ${raceResults.rank} = 1 and ${raceResults.status} = 'finished' and ${races.participantCount} >= 2)`.mapWith(Number),
        bestWpm: sql<number | null>`max(${raceResults.wpm}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(Number),
        averageWpm: sql<number | null>`avg(${raceResults.wpm}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(Number),
        averageAccuracy: sql<number | null>`avg(${raceResults.accuracy}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(Number),
      }).from(raceResults).innerJoin(races, eq(raceResults.raceId, races.id))
        .where(eq(raceResults.userId, userId));
      return stats;
    },
    async getWpmHistory(userId: string) {
      const rows = await db.select({ id: raceResults.id, wpm: raceResults.wpm, createdAt: raceResults.createdAt })
        .from(raceResults).where(and(eq(raceResults.userId, userId), ne(raceResults.status, "abandoned")))
        .orderBy(desc(raceResults.createdAt), desc(raceResults.id)).limit(50);
      return rows.reverse();
    },
  };
}
