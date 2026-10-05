// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createSession,
  destroySession,
  endSession,
  GUEST_LIFETIME_MS,
  REMEMBERED_SESSION_MS,
  SHORT_SESSION_MS,
  sessionPolicy,
  validateSession,
} from "./session";
import { MemorySessionRepository, MemoryUserRepository } from "./testSupport";
import { generateToken, hashToken } from "./token";

const NOW = new Date("2026-10-05T10:00:00.000Z");
const HOUR = 60 * 60 * 1000;

async function setup() {
  const users = new MemoryUserRepository();
  const sessions = new MemorySessionRepository(users);
  const member = await users.createMember({
    username: "alice",
    displayName: "Alice",
    passwordHash: "x",
    locale: "en",
  });
  const guest = await users.createGuest({
    displayName: "Zoé",
    locale: "fr",
    expiresAt: new Date(NOW.getTime() + GUEST_LIFETIME_MS),
  });
  return { users, sessions, memberId: member.id, guestId: guest.id };
}

describe("sessionPolicy", () => {
  it("gives a remembered member 30 days with a persistent cookie", () => {
    expect(sessionPolicy("member", true)).toEqual({
      durationMs: 30 * 24 * HOUR,
      persistent: true,
    });
    expect(REMEMBERED_SESSION_MS).toBe(30 * 24 * HOUR);
  });

  it("gives a member who is not remembered 24 hours with a session cookie", () => {
    expect(sessionPolicy("member", false)).toEqual({ durationMs: 24 * HOUR, persistent: false });
    expect(SHORT_SESSION_MS).toBe(24 * HOUR);
  });

  it("gives a guest 24 hours with a session cookie, even if remember is set", () => {
    expect(sessionPolicy("guest", false)).toEqual({ durationMs: 24 * HOUR, persistent: false });
    expect(sessionPolicy("guest", true)).toEqual({ durationMs: 24 * HOUR, persistent: false });
  });
});

describe("createSession", () => {
  it("stores only the SHA-256 of the token, never the token", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);

    expect([...sessions.sessions.keys()]).toEqual([hashToken(grant.token)]);
    expect(JSON.stringify([...sessions.sessions.values()])).not.toContain(grant.token);
  });

  it("remembered member: 30 days in database and Max-Age", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);

    expect(grant.expiresAt).toEqual(new Date(NOW.getTime() + 30 * 24 * HOUR));
    expect(grant.maxAgeSeconds).toBe(30 * 24 * 60 * 60);
    expect(sessions.sessions.get(hashToken(grant.token))?.expiresAt).toEqual(grant.expiresAt);
  });

  it("member without remember: 24 hours in database, no Max-Age", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);

    expect(grant.expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR));
    expect(grant).not.toHaveProperty("maxAgeSeconds");
  });

  it("guest: 24 hours in database, no Max-Age", async () => {
    const { sessions, guestId } = await setup();
    const grant = await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);

    expect(grant.expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR));
    expect(grant).not.toHaveProperty("maxAgeSeconds");
  });
});

describe("validateSession", () => {
  it("returns the current user for a live session", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);

    expect(await validateSession(sessions, grant.token, new Date(NOW.getTime() + HOUR))).toEqual({
      id: memberId,
      kind: "member",
      displayName: "Alice",
      username: "alice",
      locale: "en",
    });
  });

  it("returns a guest with a null username", async () => {
    const { sessions, guestId } = await setup();
    const grant = await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);

    expect(await validateSession(sessions, grant.token, NOW)).toMatchObject({
      id: guestId,
      kind: "guest",
      displayName: "Zoé",
      username: null,
    });
  });

  it("does not expose database-only fields", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);
    const user = await validateSession(sessions, grant.token, NOW);

    expect(Object.keys(user ?? {}).sort()).toEqual(["displayName", "id", "kind", "locale", "username"]);
  });

  it("returns null for an unknown token", async () => {
    const { sessions } = await setup();
    expect(await validateSession(sessions, generateToken(), NOW)).toBeNull();
  });

  it("returns null for a missing or malformed token", async () => {
    const { sessions } = await setup();
    expect(await validateSession(sessions, undefined, NOW)).toBeNull();
    expect(await validateSession(sessions, "not-a-token", NOW)).toBeNull();
  });

  it("treats an expired session as absent and deletes it", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);
    const afterExpiry = new Date(grant.expiresAt.getTime() + 1);

    expect(await validateSession(sessions, grant.token, afterExpiry)).toBeNull();
    expect(sessions.sessions.size).toBe(0);
  });

  it("expires exactly at expires_at", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);

    expect(await validateSession(sessions, grant.token, new Date(grant.expiresAt.getTime() - 1))).not.toBeNull();
    expect(await validateSession(sessions, grant.token, grant.expiresAt)).toBeNull();
  });

  it("does not extend the session when it is read", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);
    await validateSession(sessions, grant.token, new Date(NOW.getTime() + 23 * HOUR));

    expect(sessions.sessions.get(hashToken(grant.token))?.expiresAt).toEqual(grant.expiresAt);
  });

  it("rejects a session whose guest account has expired", async () => {
    const { sessions, guestId } = await setup();
    const guestExpiresAt = new Date(NOW.getTime() + GUEST_LIFETIME_MS);
    await sessions.insert({
      id: hashToken("g".repeat(43)),
      userId: guestId,
      expiresAt: new Date(NOW.getTime() + 48 * HOUR),
    });

    expect(await validateSession(sessions, "g".repeat(43), new Date(guestExpiresAt.getTime() + 1))).toBeNull();
    expect(sessions.sessions.size).toBe(0);
  });
});

describe("destroySession", () => {
  it("deletes the session so the token stops working", async () => {
    const { sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);

    await destroySession(sessions, grant.token);

    expect(sessions.sessions.size).toBe(0);
    expect(await validateSession(sessions, grant.token, NOW)).toBeNull();
  });

  it("ignores missing and malformed tokens", async () => {
    const { sessions, memberId } = await setup();
    await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);

    await destroySession(sessions, undefined);
    await destroySession(sessions, "nope");

    expect(sessions.sessions.size).toBe(1);
  });
});

describe("endSession", () => {
  it("deletes the guest account with its session (H-2)", async () => {
    const { users, sessions, guestId } = await setup();
    const grant = await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);
    const other = await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);

    await endSession(sessions, users, grant.token);

    expect(users.users.some((user) => user.id === guestId)).toBe(false);
    expect(sessions.sessions.size).toBe(0); // la cascade emporte aussi l'autre session de l'invité
    expect(sessions.sessions.has(hashToken(other.token))).toBe(false);
  });

  it("keeps a member's account and only deletes the session", async () => {
    const { users, sessions, memberId } = await setup();
    const grant = await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);
    const other = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);

    await endSession(sessions, users, grant.token);

    expect(users.users.some((user) => user.id === memberId)).toBe(true);
    expect(sessions.sessions.has(hashToken(grant.token))).toBe(false);
    expect(sessions.sessions.has(hashToken(other.token))).toBe(true);
  });

  it("does not touch other guests", async () => {
    const { users, sessions, guestId } = await setup();
    const bystander = await users.createGuest({
      displayName: "Léa",
      locale: "fr",
      expiresAt: new Date(NOW.getTime() + HOUR),
    });
    const grant = await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);
    await createSession(sessions, { userId: bystander.id, kind: "guest", remember: false }, NOW);

    await endSession(sessions, users, grant.token);

    expect(users.users.some((user) => user.id === bystander.id)).toBe(true);
    expect(sessions.sessions.size).toBe(1);
  });

  it("ignores an invalid or unknown token", async () => {
    const { users, sessions, guestId } = await setup();
    await createSession(sessions, { userId: guestId, kind: "guest", remember: false }, NOW);

    await endSession(sessions, users, undefined);
    await endSession(sessions, users, "nope");
    await endSession(sessions, users, generateToken());

    expect(users.users.some((user) => user.id === guestId)).toBe(true);
    expect(sessions.sessions.size).toBe(1);
  });

  it("deleteGuest never deletes a member, even given a member id", async () => {
    const { users, memberId } = await setup();

    await users.deleteGuest(memberId);

    expect(users.users.some((user) => user.id === memberId)).toBe(true);
  });
});

describe("deleteExpired (in-memory repository)", () => {
  it("removes only expired sessions and reports the count", async () => {
    const { sessions, memberId } = await setup();
    const short = await createSession(sessions, { userId: memberId, kind: "member", remember: false }, NOW);
    const long = await createSession(sessions, { userId: memberId, kind: "member", remember: true }, NOW);

    const deleted = await sessions.deleteExpired(new Date(NOW.getTime() + 25 * HOUR), 500);

    expect(deleted).toBe(1);
    expect(sessions.sessions.has(hashToken(short.token))).toBe(false);
    expect(sessions.sessions.has(hashToken(long.token))).toBe(true);
  });
});
