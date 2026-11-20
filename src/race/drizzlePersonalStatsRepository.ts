import { desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { races, raceResults, users } from "@/db/schema";
import { isKeyboardLayout, type KeyboardLayout } from "@/profile/profileSettings";
import {
  aggregatePersonalStats,
  MAX_DETAILED_RACES,
  type PersonalRaceRow,
  type PersonalStatsReport,
  type PersonalStatsTotals,
} from "./personalStats";

export type PersonalStatsPayload = PersonalStatsReport & {
  keyboardLayout: KeyboardLayout;
};

export function createDrizzlePersonalStatsRepository(db: PostgresJsDatabase) {
  return {
    async getPersonalStats(userId: string): Promise<PersonalStatsPayload> {
      const condition = eq(raceResults.userId, userId);

      const [totalsRows, detailRows, userRows] = await Promise.all([
        db
          .select({
            raceCount: sql<number>`count(*)`.mapWith(Number),
            finishedCount: sql<number>`count(*) filter (where ${raceResults.status} = 'finished')`.mapWith(Number),
            unfinishedCount: sql<number>`count(*) filter (where ${raceResults.status} = 'unfinished')`.mapWith(Number),
            abandonedCount: sql<number>`count(*) filter (where ${raceResults.status} = 'abandoned')`.mapWith(Number),
            wins: sql<number>`count(*) filter (where ${raceResults.rank} = 1 and ${raceResults.status} = 'finished' and ${races.participantCount} >= 2)`.mapWith(Number),
            podiums: sql<number>`count(*) filter (where ${raceResults.rank} <= 3 and ${raceResults.status} = 'finished' and ${races.participantCount} >= 2)`.mapWith(Number),
            multiplayerRaces: sql<number>`count(*) filter (where ${races.participantCount} >= 2)`.mapWith(Number),
            bestWpm: sql<number | null>`max(${raceResults.wpm}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(
              (v) => (v === null ? null : Number(v)),
            ),
            averageWpm: sql<number | null>`avg(${raceResults.wpm}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(
              (v) => (v === null ? null : Number(v)),
            ),
            averageGrossWpm: sql<number | null>`avg(${raceResults.grossWpm}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(
              (v) => (v === null ? null : Number(v)),
            ),
            averageAccuracy: sql<number | null>`avg(${raceResults.accuracy}) filter (where ${raceResults.status} <> 'abandoned')`.mapWith(
              (v) => (v === null ? null : Number(v)),
            ),
            totalDurationMs: sql<number>`coalesce(sum(${raceResults.durationMs}), 0)`.mapWith(Number),
            totalErrors: sql<number>`coalesce(sum(${raceResults.errors}), 0)`.mapWith(Number),
          })
          .from(raceResults)
          .innerJoin(races, eq(raceResults.raceId, races.id))
          .where(condition),
        db
          .select({
            id: raceResults.id,
            raceId: raceResults.raceId,
            rank: raceResults.rank,
            status: raceResults.status,
            wpm: raceResults.wpm,
            grossWpm: raceResults.grossWpm,
            accuracy: raceResults.accuracy,
            errors: raceResults.errors,
            durationMs: raceResults.durationMs,
            personalBest: raceResults.personalBest,
            missedKeys: raceResults.missedKeys,
            createdAt: raceResults.createdAt,
            endedAt: races.endedAt,
            participantCount: races.participantCount,
            config: races.config,
          })
          .from(raceResults)
          .innerJoin(races, eq(raceResults.raceId, races.id))
          .where(condition)
          .orderBy(desc(raceResults.createdAt), desc(raceResults.id))
          .limit(MAX_DETAILED_RACES),
        db.select({ keyboardLayout: users.keyboardLayout }).from(users).where(eq(users.id, userId)),
      ]);

      const sqlTotals: PersonalStatsTotals = totalsRows[0] ?? {
        raceCount: 0,
        finishedCount: 0,
        unfinishedCount: 0,
        abandonedCount: 0,
        wins: 0,
        podiums: 0,
        multiplayerRaces: 0,
        bestWpm: null,
        averageWpm: null,
        averageGrossWpm: null,
        averageAccuracy: null,
        totalDurationMs: 0,
        totalErrors: 0,
      };

      const rows: PersonalRaceRow[] = detailRows.map((row) => ({
        ...row,
        config: row.config ?? null,
      }));

      const rawLayout = userRows[0]?.keyboardLayout;
      const keyboardLayout: KeyboardLayout = isKeyboardLayout(rawLayout) ? rawLayout : "qwerty";

      return {
        ...aggregatePersonalStats(rows, sqlTotals),
        keyboardLayout,
      };
    },
  };
}
