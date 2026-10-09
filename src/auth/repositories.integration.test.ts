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
import { oauthAccounts, sessions, users } from "@/db/schema";
import { createDrizzleUserRepository } from "./drizzleUserRepository";
import { createDrizzleOAuthRepository } from "./oauth/drizzleOAuthRepository";
import { OAuthAccountTakenError } from "./oauth/oauthRepository";
import { completeOAuthSignIn } from "./oauth/signIn";
import { postgresErrorCode, UNIQUE_VIOLATION } from "./errors";
import { createSession, destroySession, GUEST_LIFETIME_MS, validateSession } from "./session";
import { createDrizzleSessionRepository } from "./sessionRepository";
import { hashToken } from "./token";
import { UsernameTakenError } from "./userRepository";
import { pseudoSkeleton, usernameSkeleton } from "./validation";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgreSQL repositories", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const createdUserIds: string[] = [];
  let client: ReturnType<typeof createDatabaseClient>;
  let userRepository: ReturnType<typeof createDrizzleUserRepository>;
  let sessionRepository: ReturnType<typeof createDrizzleSessionRepository>;
  let oauthRepository: ReturnType<typeof createDrizzleOAuthRepository>;

  beforeAll(async () => {
    client = createDatabaseClient(databaseUrl);
    await migrate(client.db, { migrationsFolder: "./drizzle" });
    userRepository = createDrizzleUserRepository(client.db);
    sessionRepository = createDrizzleSessionRepository(client.db);
    oauthRepository = createDrizzleOAuthRepository(client.db);
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

  it("creates the users, sessions and oauth_accounts tables with the expected indexes", async () => {
    const tables = await client.db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' and tablename in ('users', 'sessions', 'oauth_accounts')`,
    );
    expect(tables.map((row) => row.tablename).sort()).toEqual(["oauth_accounts", "sessions", "users"]);

    const indexes = await client.db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public' and tablename in ('users', 'sessions', 'oauth_accounts')`,
    );
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        "users_username_lower_idx",
        "users_guest_expires_at_idx",
        "sessions_user_id_idx",
        "sessions_expires_at_idx",
        "oauth_accounts_user_id_idx",
        "oauth_accounts_user_provider_idx",
        "oauth_accounts_provider_provider_account_id_pk",
      ]),
    );
  });

  it("creates a member and finds it case-insensitively", async () => {
    const id = await newMember(`Alice${suffix}`);

    const found = await userRepository.findMemberByUsername(`alice${suffix}`);

    expect(found).toMatchObject({ id, passwordHash: expect.any(String) });
  });

  it("memberUsernameExists finds a member by skeleton, and ignores guests", async () => {
    await newMember(`Bob${suffix}`);
    const guest = await userRepository.createGuest({
      displayName: `Guest2${suffix}`,
      locale: "fr",
      expiresAt: new Date(Date.now() + GUEST_LIFETIME_MS),
    });
    createdUserIds.push(guest.id);

    expect(await userRepository.memberUsernameExists(usernameSkeleton(`bob${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`BOB${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(usernameSkeleton(`nobody${suffix}`))).toBe(false);
    expect(await userRepository.memberUsernameExists(usernameSkeleton(`guest2${suffix}`))).toBe(false);
  });

  it("memberUsernameExists folds ASCII confusables on the member side like usernameSkeleton", async () => {
    await newMember(`B0b${suffix}`);
    await newMember(`rnario${suffix}`);
    await newMember(`vvill${suffix}`);
    await newMember(`Al1ce${suffix}`);
    await newMember(`ilyes${suffix}`);

    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`bob${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`mario${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`will${suffix}`))).toBe(true);
    // « I » majuscule et `i` valent `l` : « AIice » ressemble au membre « Al1ce ».
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`AIice${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`IIyes${suffix}`))).toBe(true);
    expect(await userRepository.memberUsernameExists(pseudoSkeleton(`nobody${suffix}`))).toBe(false);
  });

  it("memberUsernameExists: the SQL folding equals usernameSkeleton on edge sequences (QA parity)", async () => {
    // Séquences où l'ordre des remplacements et le chevauchement comptent, avec des `i` et des
    // `w`. Chaque membre doit être retrouvé par son propre `usernameSkeleton` calculé en TypeScript.
    const names = ["vvv", "rnrn", "rrn", "1rn0w", "RNAR1O", "VV1LL", "a|b", "0rn0", "x_1_I", "wiwi", "avw", "vwa", "rnw"];
    for (const name of names) {
      await newMember(`${name}${suffix}`);
      const skeleton = usernameSkeleton(`${name}${suffix}`);
      expect(await userRepository.memberUsernameExists(skeleton), name).toBe(true);
      // Un squelette légèrement différent ne doit pas correspondre.
      expect(await userRepository.memberUsernameExists(`${skeleton}z`), `${name} + z`).toBe(false);
    }
  });

  it("memberUsernameExists excludes the member given as exceptUserId, but finds another member with the same skeleton", async () => {
    const miaId = await newMember(`Mia${suffix}`);
    const skeleton = usernameSkeleton(`mia${suffix}`);

    expect(await userRepository.memberUsernameExists(skeleton, { exceptUserId: miaId })).toBe(false);
    expect(await userRepository.memberUsernameExists(skeleton, { exceptUserId: randomUUID() })).toBe(true);

    const m1aId = await newMember(`m1a${suffix}`);
    expect(usernameSkeleton(`m1a${suffix}`)).toBe(skeleton);
    expect(await userRepository.memberUsernameExists(skeleton, { exceptUserId: miaId })).toBe(true);
    expect(await userRepository.memberUsernameExists(skeleton, { exceptUserId: m1aId })).toBe(true);
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
    // un membre sans mot de passe est permis (compte GitHub ou Discord) ; sans identifiant, jamais
    const [passwordless] = await insert({ username: `c2${suffix}` }).returning({ id: users.id });
    createdUserIds.push(passwordless.id);
    await expect(insert({ username: null })).rejects.toThrow();
    // un invité avec un mot de passe
    await expect(insert({ kind: "guest", passwordHash: "h", expiresAt: new Date() })).rejects.toThrow();
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
    const member = await newMember(`stay${suffix}`);

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

  describe("oauth_accounts", () => {
    const accountId = () => `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    /**
     * Insertion directe (l'application ne relie jamais un compte à un membre existant) : vrai si
     * insérée, faux si une contrainte d'unicité la refuse, erreur pour tout autre refus.
     */
    const insertLink = async (provider: "github" | "discord", providerAccountId: string, userId: string) => {
      try {
        await client.db.insert(oauthAccounts).values({ provider, providerAccountId, userId });
        return true;
      } catch (error) {
        if (postgresErrorCode(error) === UNIQUE_VIOLATION) return false;
        throw error;
      }
    };

    it("creates a passwordless member and its link together, and the member cannot log in by password", async () => {
      const providerAccountId = accountId();
      const { id } = await oauthRepository.createMemberWithAccount({
        provider: "github",
        providerAccountId,
        username: `oa${suffix}`,
        displayName: "Octo",
        locale: "fr",
      });
      createdUserIds.push(id);

      const [row] = await client.db.select().from(users).where(eq(users.id, id));
      expect(row).toMatchObject({ kind: "member", username: `oa${suffix}`, passwordHash: null });
      expect(await oauthRepository.findUserIdByAccount({ provider: "github", providerAccountId })).toBe(id);
      expect(await userRepository.findMemberByUsername(`oa${suffix}`)).toBeNull();
      const links = await client.db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, id));
      expect(links).toHaveLength(1);
      // Seulement le fournisseur et l'identifiant numérique : ni login, ni e-mail, ni jeton.
      expect(Object.keys(links[0]).sort()).toEqual(["createdAt", "provider", "providerAccountId", "userId"]);
    });

    it("leaves no orphan user when the link insertion fails (transaction rolled back)", async () => {
      const providerAccountId = accountId();
      const owner = await newMember(`own${suffix}`);
      await insertLink("discord", providerAccountId, owner);

      await expect(
        oauthRepository.createMemberWithAccount({
          provider: "discord",
          providerAccountId,
          username: `orphan${suffix}`,
          displayName: "Orphan",
          locale: "fr",
        }),
      ).rejects.toBeInstanceOf(OAuthAccountTakenError);

      expect(await client.db.select().from(users).where(eq(users.username, `orphan${suffix}`))).toHaveLength(0);
      expect(await oauthRepository.findUserIdByAccount({ provider: "discord", providerAccountId })).toBe(owner);
    });

    it("leaves no link when the username is taken, with UsernameTakenError", async () => {
      await newMember(`taken${suffix}`);
      const providerAccountId = accountId();

      await expect(
        oauthRepository.createMemberWithAccount({
          provider: "github",
          providerAccountId,
          username: `TAKEN${suffix}`,
          displayName: "x",
          locale: "fr",
        }),
      ).rejects.toBeInstanceOf(UsernameTakenError);

      expect(await oauthRepository.findUserIdByAccount({ provider: "github", providerAccountId })).toBeNull();
    });

    it("the primary key is (provider, id): the same id is free on the other provider", async () => {
      const providerAccountId = accountId();
      const first = await newMember(`pk1${suffix}`);
      const second = await newMember(`pk2${suffix}`);

      expect(await insertLink("github", providerAccountId, first)).toBe(true);
      expect(await insertLink("github", providerAccountId, second)).toBe(false);
      expect(await insertLink("discord", providerAccountId, second)).toBe(true);
      expect(await oauthRepository.findUserIdByAccount({ provider: "github", providerAccountId })).toBe(first);
    });

    it("lets one member hold both GitHub and Discord", async () => {
      const member = await newMember(`both${suffix}`);

      expect(await insertLink("github", accountId(), member)).toBe(true);
      expect(await insertLink("discord", accountId(), member)).toBe(true);
      expect(await client.db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, member))).toHaveLength(2);
    });

    it("rejects an unknown provider and a link to a missing user", async () => {
      const member = await newMember(`bad${suffix}`);

      await expect(
        client.db.insert(oauthAccounts).values({ provider: "twitter", providerAccountId: accountId(), userId: member }),
      ).rejects.toThrow();
      await expect(
        insertLink("github", accountId(), randomUUID()),
      ).rejects.toThrow();
    });

    it("allows at most one account per provider and member (unique index on user_id, provider)", async () => {
      const member = await newMember(`uniq${suffix}`);
      expect(await insertLink("github", accountId(), member)).toBe(true);

      expect(await insertLink("github", accountId(), member)).toBe(false);
      expect(await client.db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, member))).toHaveLength(1);
    });

    it("creates the member through the repository with a display name equal to the username", async () => {
      const { id } = await oauthRepository.createMemberWithAccount({
        provider: "discord",
        providerAccountId: accountId(),
        username: `dn${suffix}`,
        displayName: `dn${suffix}`,
        locale: "fr",
      });
      createdUserIds.push(id);

      const [row] = await client.db.select().from(users).where(eq(users.id, id));
      expect(row.displayName).toBe(row.username);
    });

    it("deleting the user cascades to its links", async () => {
      const providerAccountId = accountId();
      const member = await newMember(`casc${suffix}`);
      await insertLink("github", providerAccountId, member);

      await client.db.delete(users).where(eq(users.id, member));

      expect(await oauthRepository.findUserIdByAccount({ provider: "github", providerAccountId })).toBeNull();
      expect(await client.db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, member))).toHaveLength(0);
    });

    it("signs in with the real repositories: creation, then the same account finds the same member", async () => {
      const deps = {
        users: userRepository,
        oauthAccounts: oauthRepository,
        sessions: sessionRepository,
        // Non utilisés par ce parcours.
        limiters: undefined as never,
        passwords: undefined as never,
        now: () => new Date(),
      };
      const profile = { accountId: accountId(), login: `Real-${suffix}` };

      await completeOAuthSignIn(deps, { provider: "github", profile, locale: "en" });
      await completeOAuthSignIn(deps, { provider: "github", profile, locale: "en" });

      const ownerId = await oauthRepository.findUserIdByAccount({ provider: "github", providerAccountId: profile.accountId });
      if (ownerId === null) throw new Error("expected a link");
      createdUserIds.push(ownerId);
      expect(await client.db.select().from(sessions).where(eq(sessions.userId, ownerId))).toHaveLength(2);
      expect(await client.db.select().from(users).where(eq(users.id, ownerId))).toMatchObject([
        { username: `real-${suffix}`.replace("-", "_"), displayName: `real_${suffix}`, passwordHash: null, locale: "en" },
      ]);
    });
  });
});
