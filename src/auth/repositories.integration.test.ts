// @vitest-environment node
//
// Test d'intégration contre un vrai PostgreSQL. Ignoré sans `DATABASE_URL`.
// Lancer : DATABASE_URL=postgresql://typio:typio@localhost:5433/typio bun run test
// Les migrations de `drizzle/` sont appliquées au démarrage ; chaque test travaille sur
// des identifiants uniques et nettoie derrière lui. Ne pas pointer vers une base de production.
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { createDrizzleUserRepository } from "./drizzleUserRepository";
import { createSession, destroySession, GUEST_LIFETIME_MS, validateSession } from "./session";
import { createDrizzleSessionRepository } from "./sessionRepository";
import { hashToken } from "./token";
import { UsernameTakenError } from "./userRepository";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL repositories", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const createdUserIds: string[] = [];
  let client: ReturnType<typeof createDatabaseClient>;
  let userRepository: ReturnType<typeof createDrizzleUserRepository>;
  let sessionRepository: ReturnType<typeof createDrizzleSessionRepository>;

  beforeAll(async () => {
    client = createDatabaseClient(databaseUrl);
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    userRepository = createDrizzleUserRepository(client.db);
    sessionRepository = createDrizzleSessionRepository(client.db);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await client.db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await client.close();
  });

  async function newMember(name: string) {
    const { id } = await userRepository.createMember({
      username: name,
      displayName: name,
      passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA",
      locale: "fr",
    });
    createdUserIds.push(id);
    return id;
  }

  it("creates exactly the users and sessions tables with the expected indexes", async () => {
    const tables = await client.db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' and tablename in ('users', 'sessions')`,
    );
    expect(tables.map((row) => row.tablename).sort()).toEqual(["sessions", "users"]);

    const indexes = await client.db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public' and tablename in ('users', 'sessions')`,
    );
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "users_username_lower_idx",
        "users_guest_expires_at_idx",
        "sessions_user_id_idx",
        "sessions_expires_at_idx",
      ]),
    );
  });

  it("creates a member and finds it case-insensitively", async () => {
    const id = await newMember(`Alice${suffix}`);

    const found = await userRepository.findMemberByUsername(`alice${suffix}`);

    expect(found).toMatchObject({ id, passwordHash: expect.any(String) });
  });

  it("memberUsernameExists finds a member by lowercase username, and ignores guests", async () => {
    await newMember(`Bob${suffix}`);
    const guest = await userRepository.createGuest({
      displayName: `Guest2${suffix}`,
      locale: "fr",
      expiresAt: new Date(Date.now() + GUEST_LIFETIME_MS),
    });
    createdUserIds.push(guest.id);

    expect(await userRepository.memberUsernameExists(`bob${suffix}`)).toBe(true);
    expect(await userRepository.memberUsernameExists(`nobody${suffix}`)).toBe(false);
    expect(await userRepository.memberUsernameExists(`guest2${suffix}`)).toBe(false);
  });

  it("deleteGuest removes a guest and its sessions, and never a member", async () => {
    const memberId = await newMember(`keep${suffix}`);
    const guest = await userRepository.createGuest({
      displayName: `Gone${suffix}`,
      locale: "fr",
      expiresAt: new Date(Date.now() + GUEST_LIFETIME_MS),
    });
    createdUserIds.push(guest.id);
    const grant = await createSession(sessionRepository, { userId: guest.id, kind: "guest", remember: false }, new Date());

    await userRepository.deleteGuest(guest.id);
    await userRepository.deleteGuest(memberId);

    expect(await client.db.select().from(users).where(eq(users.id, guest.id))).toHaveLength(0);
    expect(await client.db.select().from(sessions).where(eq(sessions.id, hashToken(grant.token)))).toHaveLength(0);
    expect(await client.db.select().from(users).where(eq(users.id, memberId))).toHaveLength(1);
  });

  it("rejects a duplicate username regardless of case with UsernameTakenError", async () => {
    await newMember(`dup${suffix}`);

    await expect(
      userRepository.createMember({
        username: `DUP${suffix}`,
        displayName: "x",
        passwordHash: "h",
        locale: "fr",
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it("creates a guest that is not found as a member", async () => {
    const { id } = await userRepository.createGuest({
      displayName: `Guest${suffix}`,
      locale: "en",
      expiresAt: new Date(Date.now() + GUEST_LIFETIME_MS),
    });
    createdUserIds.push(id);

    const [row] = await client.db.select().from(users).where(eq(users.id, id));
    expect(row).toMatchObject({ kind: "guest", username: null, passwordHash: null, locale: "en" });
    expect(await userRepository.findMemberByUsername(`guest${suffix}`)).toBeNull();
  });

  it("enforces the CHECK constraints", async () => {
    const insert = (values: Partial<typeof users.$inferInsert>) =>
      client.db.insert(users).values({ kind: "member", displayName: "x", ...values });

    await expect(insert({ kind: "robot", username: `c1${suffix}`, passwordHash: "h" })).rejects.toThrow();
    // un membre sans mot de passe
    await expect(insert({ username: `c2${suffix}` })).rejects.toThrow();
    // un membre sans identifiant
    await expect(insert({ passwordHash: "h" })).rejects.toThrow();
    // un invité avec un identifiant, ou sans expiration
    await expect(insert({ kind: "guest", username: `c3${suffix}`, expiresAt: new Date() })).rejects.toThrow();
    await expect(insert({ kind: "guest" })).rejects.toThrow();
    await expect(insert({ username: `c4${suffix}`, passwordHash: "h", locale: "de" })).rejects.toThrow();
    await expect(
      insert({ username: `c5${suffix}`, passwordHash: "h", keyboardLayout: "dvorak" }),
    ).rejects.toThrow();
  });

  it("stores only the token hash and resolves it back to the user", async () => {
    const userId = await newMember(`sess${suffix}`);
    const grant = await createSession(sessionRepository, { userId, kind: "member", remember: false }, new Date());

    const rows = await client.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(rows.map((row) => row.id)).toEqual([hashToken(grant.token)]);
    expect(rows[0].id).not.toBe(grant.token);

    expect(await validateSession(sessionRepository, grant.token, new Date())).toMatchObject({
      id: userId,
      kind: "member",
    });
  });

  it("treats an expired session as absent and deletes it", async () => {
    const userId = await newMember(`exp${suffix}`);
    const grant = await createSession(
      sessionRepository,
      { userId, kind: "member", remember: false },
      new Date(Date.now() - 25 * 60 * 60 * 1000),
    );

    expect(await validateSession(sessionRepository, grant.token, new Date())).toBeNull();
    expect(await client.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });

  it("deleteExpired removes only expired sessions", async () => {
    const userId = await newMember(`purge${suffix}`);
    const now = new Date();
    await createSession(sessionRepository, { userId, kind: "member", remember: false }, new Date(now.getTime() - 25 * 3600_000));
    const live = await createSession(sessionRepository, { userId, kind: "member", remember: true }, now);

    const deleted = await sessionRepository.deleteExpired(now, 500);

    expect(deleted).toBeGreaterThanOrEqual(1);
    const remaining = await client.db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining.map((row) => row.id)).toEqual([hashToken(live.token)]);
  });

  it("deleteExpired honors the batch limit", async () => {
    const userId = await newMember(`batch${suffix}`);
    const longAgo = new Date(Date.now() - 48 * 3600_000);
    for (let i = 0; i < 3; i += 1) {
      await createSession(sessionRepository, { userId, kind: "member", remember: false }, longAgo);
    }
    // Les sessions d'autres tests peuvent aussi être échues : on compare avant et après.
    const countExpired = async () =>
      (await client.db.select().from(sessions).where(eq(sessions.userId, userId))).length;
    expect(await countExpired()).toBe(3);

    const deleted = await sessionRepository.deleteExpired(new Date(), 1);

    expect(deleted).toBe(1);
  });

  it("deleteExpiredGuests removes only expired guests, bounded by the limit, with their sessions", async () => {
    const past = new Date(Date.now() - 3600_000);
    const future = new Date(Date.now() + 3600_000);
    const expired = await userRepository.createGuest({ displayName: `old${suffix}`, locale: "fr", expiresAt: past });
    const alive = await userRepository.createGuest({ displayName: `new${suffix}`, locale: "fr", expiresAt: future });
    createdUserIds.push(alive.id);
    await createSession(sessionRepository, { userId: expired.id, kind: "guest", remember: false }, new Date());
    const member = await newMember(`keep${suffix}`);

    const deleted = await userRepository.deleteExpiredGuests(new Date(), 500);

    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await client.db.select().from(users).where(eq(users.id, expired.id))).toHaveLength(0);
    expect(await client.db.select().from(sessions).where(eq(sessions.userId, expired.id))).toHaveLength(0);
    expect(await client.db.select().from(users).where(eq(users.id, alive.id))).toHaveLength(1);
    expect(await client.db.select().from(users).where(eq(users.id, member))).toHaveLength(1);
    expect(await userRepository.deleteExpiredGuests(new Date(), 0)).toBe(0);
  });

  it("rejects a username longer than 20 characters and a display name longer than 40", async () => {
    const insert = (values: Partial<typeof users.$inferInsert>) =>
      client.db.insert(users).values({ kind: "member", passwordHash: "h", displayName: "x", ...values });

    await expect(insert({ username: `a${suffix}`.padEnd(21, "a") })).rejects.toThrow();
    await expect(insert({ username: `l${suffix}`, displayName: "d".repeat(41) })).rejects.toThrow();
  });

  it("findWithUser returns null for an unknown session id", async () => {
    expect(await sessionRepository.findWithUser("0".repeat(64))).toBeNull();
  });

  it("destroySession deletes the row, and deleting the user cascades to its sessions", async () => {
    const userId = await newMember(`cascade${suffix}`);
    const first = await createSession(sessionRepository, { userId, kind: "member", remember: false }, new Date());
    await createSession(sessionRepository, { userId, kind: "member", remember: false }, new Date());

    await destroySession(sessionRepository, first.token);
    expect(await client.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(1);

    await client.db.delete(users).where(eq(users.id, userId));
    expect(await client.db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });
});
