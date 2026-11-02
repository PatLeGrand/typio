// @vitest-environment node
// PostgreSQL réel ; ignoré sans DATABASE_URL. Identifiants uniques et nettoyage après les tests.
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/db/client";
import { races, raceResults, users } from "@/db/schema";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import { createDrizzleProfileStatsRepository } from "./drizzleProfileStatsRepository";
import { createDrizzleRaceHistoryRepository } from "./drizzleRaceHistoryRepository";
import { createDrizzleRaceRepository } from "./drizzleRaceRepository";
import type { NewRace, NewRaceResult } from "./raceRepository";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL race repository", () => {
  let client: ReturnType<typeof createDatabaseClient>;
  let repository: ReturnType<typeof createDrizzleRaceRepository>;
  const userIds: string[] = [];
  const raceIds: string[] = [];

  beforeAll(async () => {
    client = createDatabaseClient(databaseUrl);
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    repository = createDrizzleRaceRepository(client.db);
  });
  afterAll(async () => {
    if (!client) return;
    if (raceIds.length) await client.db.delete(races).where(inArray(races.id, raceIds));
    if (userIds.length) await client.db.delete(users).where(inArray(users.id, userIds));
    await client.close();
  });

  async function member() {
    const id = randomUUID();
    await client.db.insert(users).values({ id, kind: "member", username: id.slice(0, 20), displayName: "Membre" });
    userIds.push(id);
    return id;
  }
  function race(hostId: string): NewRace {
    const id = randomUUID();
    raceIds.push(id);
    return { id, roomCode: "ABCDEF", hostId, config: { ...DEFAULT_ROOM_CONFIG }, text: "abc",
      participantCount: 3, startedAt: new Date(1_000), endedAt: new Date(4_000) };
  }
  function result(userId: string): NewRaceResult {
    return { userId, rank: 1, status: "finished", wpm: 12, grossWpm: 16, accuracy: 75,
      errors: 1, durationMs: 3_000, progress: 1, wpmSeries: [0, 12, 12], missedKeys: { b: 1 } };
  }

  it("insère la configuration, les métriques et la série ; supprime les résultats du membre et détache l’hôte", async () => {
    const hostId = await member();
    const data = race(hostId);
    await repository.recordRace(data, [result(hostId)]);
    const [savedRace] = await client.db.select().from(races).where(eq(races.id, data.id!));
    expect(savedRace).toMatchObject(data);
    const [savedResult] = await client.db.select().from(raceResults).where(eq(raceResults.raceId, data.id!));
    expect(savedResult).toMatchObject({ ...result(hostId), raceId: data.id, createdAt: expect.any(Date) });
    const history = createDrizzleRaceHistoryRepository(client.db);
    const detail = await history.getRaceForUser(hostId, data.id!);
    expect(detail?.missedKeys).toEqual({ b: 1 });
    expect(detail?.rows[0].wpmSeries).toEqual([0, 12, 12]);
    expect(detail?.rows[0]).not.toHaveProperty("missedKeys");
    await client.db.delete(users).where(eq(users.id, hostId));
    expect(await client.db.select().from(raceResults).where(eq(raceResults.raceId, data.id!))).toHaveLength(0);
    expect(await client.db.select().from(races).where(eq(races.id, data.id!))).toMatchObject([{ hostId: null }]);
  });

  it("supprime les résultats avec la course et accepte une course sans membre classé", async () => {
    const hostId = await member();
    const data = race(hostId);
    await repository.recordRace(data, [result(hostId)]);
    await client.db.delete(races).where(eq(races.id, data.id!));
    expect(await client.db.select().from(raceResults).where(eq(raceResults.raceId, data.id!))).toHaveLength(0);
    const empty = race(hostId);
    await repository.recordRace(empty, []);
    expect(await client.db.select().from(races).where(eq(races.id, empty.id!))).toHaveLength(1);
  });

  // Protège la comparaison stricte au meilleur antérieur et les exclusions H-26.
  it("persiste les records et agrège les courses admissibles, avec les victoires à plusieurs classés", async () => {
    const userId = await member();
    const stats = createDrizzleProfileStatsRepository(client.db);
    expect(await stats.getUserStats(userId)).toEqual({
      raceCount: 0, wins: 0, bestWpm: null, averageWpm: null, averageAccuracy: null,
    });
    const cases = [
      { wpm: 20, accuracy: 80, status: "finished", rank: 1, participants: 1, record: false },
      { wpm: 30, accuracy: 90, status: "finished", rank: 1, participants: 2, record: true },
      { wpm: 30, accuracy: 90, status: "finished", rank: 2, participants: 3, record: false },
      { wpm: 100, accuracy: 10, status: "abandoned", rank: 1, participants: 3, record: false },
      { wpm: 40, accuracy: 100, status: "unfinished", rank: 1, participants: 3, record: true },
    ] as const;
    for (const [index, entry] of cases.entries()) {
      const data = { ...race(userId), participantCount: entry.participants };
      const records = await repository.recordRace(data, [{ ...result(userId), ...entry }]);
      expect(records).toEqual(entry.record ? [userId] : []);
      const [saved] = await client.db.select().from(raceResults).where(eq(raceResults.raceId, data.id!));
      expect(saved.personalBest).toBe(entry.record);
      await client.db.update(raceResults).set({ createdAt: new Date(index * 1_000) }).where(eq(raceResults.id, saved.id));
      const detail = await createDrizzleRaceHistoryRepository(client.db).getRaceForUser(userId, data.id!);
      expect(detail?.rows[0].personalBest).toBe(entry.record);
    }
    expect(await stats.getUserStats(userId)).toEqual({
      raceCount: 5, wins: 1, bestWpm: 40, averageWpm: 30, averageAccuracy: 90,
    });
    expect((await stats.getWpmHistory(userId)).map((row) => row.wpm)).toEqual([20, 30, 30, 40]);
    const history = await createDrizzleRaceHistoryRepository(client.db).listUserRaces(userId, { page: 1, pageSize: 20 });
    expect(history.items.map((row) => row.personalBest)).toEqual([true, false, false, true, false]);
    const other = await member();
    await repository.recordRace(race(other), [{ ...result(other), status: "abandoned", wpm: 100 }]);
    expect(await stats.getUserStats(other)).toEqual({
      raceCount: 1, wins: 0, bestWpm: null, averageWpm: null, averageAccuracy: null,
    });
    expect(await stats.getWpmHistory(other)).toEqual([]);
    expect(await repository.recordRace(race(other), [result(other)])).toEqual([]);
  });

  it("annule toute la transaction si un résultat est invalide ou dupliqué", async () => {
    const hostId = await member();
    for (const rows of [[result(randomUUID())], [result(hostId), result(hostId)], [{ ...result(hostId), progress: 2 }]]) {
      const data = race(hostId);
      await expect(repository.recordRace(data, rows)).rejects.toThrow();
      expect(await client.db.select().from(races).where(eq(races.id, data.id!))).toHaveLength(0);
    }
  });
});
