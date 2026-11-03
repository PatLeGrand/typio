// @vitest-environment node
import { inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase, SEED_RACE_IDS, SEED_USER_IDS, DEMO_PASSWORD } from "../../scripts/seed/data";
import { SENTENCES_FR } from "../../scripts/seed/sentences.fr";
import { SENTENCES_EN } from "../../scripts/seed/sentences.en";
import { verifyPassword } from "@/auth/password";
import { createDatabaseClient } from "./client";
import { races, raceResults, textPassages, users } from "./schema";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL seed idempotence", () => {
  let client: ReturnType<typeof createDatabaseClient>;
  let originalUserIds: string[] = [];
  let originalRaceIds: string[] = [];
  let originalPassageIds: string[] = [];
  let seeded = false;

  beforeAll(async () => {
    client = createDatabaseClient(databaseUrl);
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    originalUserIds = (await client.db.select({ id: users.id }).from(users)).map((row) => row.id);
    originalRaceIds = (await client.db.select({ id: races.id }).from(races)).map((row) => row.id);
    originalPassageIds = (await client.db.select({ id: textPassages.id }).from(textPassages)).map((row) => row.id);
  });
  afterAll(async () => {
    if (!client) return;
    if (seeded) {
      const newRaces = SEED_RACE_IDS.filter((id) => !originalRaceIds.includes(id));
      const newUsers = SEED_USER_IDS.filter((id) => !originalUserIds.includes(id));
      const newPassages = (await client.db.select().from(textPassages))
        .filter((row) => !originalPassageIds.includes(row.id) &&
          (row.language === "fr" ? SENTENCES_FR : SENTENCES_EN).includes(row.content)).map((row) => row.id);
      if (newRaces.length) await client.db.delete(races).where(inArray(races.id, newRaces));
      if (newUsers.length) await client.db.delete(users).where(inArray(users.id, newUsers));
      if (newPassages.length) await client.db.delete(textPassages).where(inArray(textPassages.id, newPassages));
    }
    await client.close();
  });

  async function snapshot() {
    return {
      passages: await client.db.select().from(textPassages).orderBy(textPassages.id),
      members: await client.db.select().from(users).where(inArray(users.id, SEED_USER_IDS)).orderBy(users.id),
      history: await client.db.select().from(races).where(inArray(races.id, SEED_RACE_IDS)).orderBy(races.id),
      results: await client.db.select().from(raceResults).where(inArray(raceResults.raceId, SEED_RACE_IDS)).orderBy(raceResults.id),
    };
  }

  it("rejoue sans doublon ni changement de mot de passe ou d’historique", async () => {
    await seedDatabase(client.db);
    seeded = true;
    const first = await snapshot();
    await seedDatabase(client.db);
    expect(await snapshot()).toEqual(first);
    expect(first.passages.length).toBeGreaterThanOrEqual(SENTENCES_FR.length + SENTENCES_EN.length);
    expect(first.members).toHaveLength(3);
    expect(first.members.every((user) => user.isDemo && user.kind === "member")).toBe(true);
    expect(await verifyPassword(first.members[0].passwordHash!, DEMO_PASSWORD)).toBe(true);
    expect(first.history).toHaveLength(3);
    expect(first.results).toHaveLength(9);
  });
});
