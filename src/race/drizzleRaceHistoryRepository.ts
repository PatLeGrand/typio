import { and, asc, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { races, raceResults, users } from "@/db/schema";
import { historyOffset, historyPage } from "./raceHistory";

export function createDrizzleRaceHistoryRepository(db: PostgresJsDatabase) {
  return {
    async listUserRaces(userId: string, { page, pageSize }: { page: number; pageSize: number }) {
      const rows = await db.select({
        raceId: races.id, endedAt: races.endedAt, rank: raceResults.rank,
        participantCount: races.participantCount, wpm: raceResults.wpm,
        accuracy: raceResults.accuracy, status: raceResults.status,
      }).from(raceResults).innerJoin(races, eq(raceResults.raceId, races.id))
        .where(eq(raceResults.userId, userId))
        .orderBy(desc(raceResults.createdAt), desc(raceResults.id))
        .limit(pageSize + 1).offset(historyOffset(page, pageSize));
      return historyPage(rows, pageSize);
    },
    async getRaceForUser(userId: string, raceId: string) {
      const [race] = await db.select({
        id: races.id, endedAt: races.endedAt, participantCount: races.participantCount,
      }).from(races).innerJoin(raceResults, eq(raceResults.raceId, races.id))
        .where(and(eq(races.id, raceId), eq(raceResults.userId, userId)));
      if (!race) return null;
      const rows = await db.select({
        id: raceResults.userId, name: users.displayName, rank: raceResults.rank,
        wpm: raceResults.wpm, grossWpm: raceResults.grossWpm, accuracy: raceResults.accuracy,
        errors: raceResults.errors, timeMs: raceResults.durationMs, status: raceResults.status,
      }).from(raceResults).innerJoin(users, eq(raceResults.userId, users.id))
        .where(eq(raceResults.raceId, raceId)).orderBy(asc(raceResults.rank), asc(raceResults.id));
      return { ...race, rows };
    },
  };
}
