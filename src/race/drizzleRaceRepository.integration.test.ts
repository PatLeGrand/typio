// @vitest-environment node
// PostgreSQL réel ; ignoré sans DATABASE_URL. Identifiants uniques et nettoyage après les tests.
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/db/client";
import { races, raceResults, users } from "@/db/schema";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
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
      errors: 1, durationMs: 3_000, progress: 1, wpmSeries: [0, 12, 12] };
  }

  it("insère la configuration, les métriques et la série ; supprime les résultats du membre et détache l’hôte", async () => {
    const hostId = await member();
    const data = race(hostId);
    await repository.recordRace(data, [result(hostId)]);
    const [savedRace] = await client.db.select().from(races).where(eq(races.id, data.id!));
    expect(savedRace).toMatchObject(data);
    const [savedResult] = await client.db.select().from(raceResults).where(eq(raceResults.raceId, data.id!));
    expect(savedResult).toMatchObject({ ...result(hostId), raceId: data.id, createdAt: expect.any(Date) });
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

  it("annule toute la transaction si un résultat est invalide ou dupliqué", async () => {
    const hostId = await member();
    for (const rows of [[result(randomUUID())], [result(hostId), result(hostId)], [{ ...result(hostId), progress: 2 }]]) {
      const data = race(hostId);
      await expect(repository.recordRace(data, rows)).rejects.toThrow();
      expect(await client.db.select().from(races).where(eq(races.id, data.id!))).toHaveLength(0);
    }
  });
});
