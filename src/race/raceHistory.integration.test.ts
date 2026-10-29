// @vitest-environment node
// PostgreSQL réel ; ignoré sans DATABASE_URL. Identifiants uniques et nettoyage après les tests.
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/db/client";
import { races, raceResults, users } from "@/db/schema";
import { DEFAULT_ROOM_CONFIG } from "@/realtime/protocol";
import { createDrizzleRaceHistoryRepository } from "./drizzleRaceHistoryRepository";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL race history", () => {
  let client: ReturnType<typeof createDatabaseClient>;
  let repository: ReturnType<typeof createDrizzleRaceHistoryRepository>;
  const firstUser = randomUUID();
  const secondUser = randomUUID();
  const raceIds = Array.from({ length: 4 }, () => randomUUID());
  // Deux résultats à la même date : l'identifiant départage l'ordre de façon stable.
  const resultIds = Array.from({ length: 3 }, () => randomUUID()).sort();

  beforeAll(async () => {
    client = createDatabaseClient(databaseUrl);
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    repository = createDrizzleRaceHistoryRepository(client.db);
    await client.db.insert(users).values([
      { id: firstUser, kind: "member", username: firstUser.slice(0, 20), displayName: "Alice" },
      { id: secondUser, kind: "member", username: secondUser.slice(0, 20), displayName: "Bob" },
    ]);
    await client.db.insert(races).values(raceIds.map((id) => ({
      id, roomCode: "ABCDEF", hostId: firstUser, config: { ...DEFAULT_ROOM_CONFIG },
      text: "abc", participantCount: 4, startedAt: new Date(1_000), endedAt: new Date(4_000),
    })));
    const metrics = { rank: 2, status: "finished" as const, wpm: 12, grossWpm: 16, accuracy: 75,
      errors: 1, durationMs: 3_000, progress: 1, wpmSeries: [0, 12] };
    await client.db.insert(raceResults).values([
      ...resultIds.map((id, index) => ({
        ...metrics, id, raceId: raceIds[index], userId: firstUser,
        status: (["finished", "unfinished", "abandoned"] as const)[index],
        createdAt: new Date(index === 0 ? 1_000 : 2_000),
      })),
      { ...metrics, raceId: raceIds[2], userId: secondUser, rank: 1, createdAt: new Date(2_000) },
      { ...metrics, raceId: raceIds[3], userId: secondUser, createdAt: new Date(3_000) },
    ]);
  });
  afterAll(async () => {
    if (!client) return;
    await client.db.delete(races).where(inArray(races.id, raceIds));
    await client.db.delete(users).where(inArray(users.id, [firstUser, secondUser]));
    await client.close();
  });

  it("ordonne du plus récent au plus ancien, départage les dates égales et pagine sans doublon", async () => {
    const first = await repository.listUserRaces(firstUser, { page: 1, pageSize: 2 });
    expect(first.items.map((row) => row.raceId)).toEqual([raceIds[2], raceIds[1]]);
    expect(first.hasNext).toBe(true);
    expect(first.items[0]).toMatchObject({ rank: 2, participantCount: 4, wpm: 12, accuracy: 75, status: "abandoned", endedAt: new Date(4_000) });
    const second = await repository.listUserRaces(firstUser, { page: 2, pageSize: 2 });
    expect(second.items.map((row) => row.raceId)).toEqual([raceIds[0]]);
    expect(second.hasNext).toBe(false);
    expect(await repository.listUserRaces(firstUser, { page: 3, pageSize: 2 })).toEqual({ items: [], hasNext: false });
  });

  it("isole les listes de deux membres", async () => {
    const page = await repository.listUserRaces(secondUser, { page: 1, pageSize: 2 });
    expect(page.items.map((row) => row.raceId)).toEqual([raceIds[3], raceIds[2]]);
    expect(page.hasNext).toBe(false);
    expect(await repository.listUserRaces(randomUUID(), { page: 1, pageSize: 2 })).toEqual({ items: [], hasNext: false });
  });

  it("ne distingue pas une course absente d'une course sans participation", async () => {
    expect(await repository.getRaceForUser(secondUser, raceIds[0])).toBeNull();
    expect(await repository.getRaceForUser(firstUser, randomUUID())).toBeNull();
  });

  it("montre à un participant tous les membres enregistrés dans l'ordre du rang", async () => {
    const race = await repository.getRaceForUser(firstUser, raceIds[2]);
    expect(race).toMatchObject({ id: raceIds[2], endedAt: new Date(4_000), participantCount: 4 });
    expect(race?.rows).toEqual([
      { id: secondUser, name: "Bob", rank: 1, wpm: 12, grossWpm: 16, accuracy: 75, errors: 1, timeMs: 3_000, status: "finished" },
      { id: firstUser, name: "Alice", rank: 2, wpm: 12, grossWpm: 16, accuracy: 75, errors: 1, timeMs: 3_000, status: "abandoned" },
    ]);
  });
});
