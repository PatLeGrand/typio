// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { PURGE_MIN_INTERVAL_MS, purgeExpired, resetPurgeThrottle } from "./purge";
import { PURGE_BATCH_SIZE } from "./session";
import { createTestDeps } from "./testSupport";

function instrument(test: ReturnType<typeof createTestDeps>) {
  const calls = { sessions: [] as [Date, number][], guests: [] as [Date, number][] };
  const deleteExpired = test.sessions.deleteExpired.bind(test.sessions);
  const deleteExpiredGuests = test.users.deleteExpiredGuests.bind(test.users);
  test.sessions.deleteExpired = async (now, limit) => {
    calls.sessions.push([now, limit]);
    return deleteExpired(now, limit);
  };
  test.users.deleteExpiredGuests = async (now, limit) => {
    calls.guests.push([now, limit]);
    return deleteExpiredGuests(now, limit);
  };
  return calls;
}

let test: ReturnType<typeof createTestDeps>;

beforeEach(() => {
  test = createTestDeps();
});

describe("purgeExpired", () => {
  it("purges sessions and guests in batches of 500", async () => {
    const calls = instrument(test);

    await purgeExpired(test.deps);

    expect(PURGE_BATCH_SIZE).toBe(500);
    expect(calls.sessions).toEqual([[test.deps.now(), 500]]);
    expect(calls.guests).toEqual([[test.deps.now(), 500]]);
  });

  it("runs at most once per minute", async () => {
    const calls = instrument(test);

    await purgeExpired(test.deps);
    test.advance(PURGE_MIN_INTERVAL_MS - 1);
    await purgeExpired(test.deps);
    await purgeExpired(test.deps);
    expect(calls.sessions).toHaveLength(1);

    test.advance(1);
    await purgeExpired(test.deps);
    expect(calls.sessions).toHaveLength(2);
    expect(calls.guests).toHaveLength(2);
  });

  it("is shared across calls through globalThis, not per deps object", async () => {
    const calls = instrument(test);
    await purgeExpired(test.deps);

    // Un second jeu de dépendances (autre instance du module) n'a pas à repurger.
    await purgeExpired({ ...test.deps });

    expect(calls.sessions).toHaveLength(1);
  });

  it("purges again when the clock went backwards", async () => {
    const calls = instrument(test);
    await purgeExpired(test.deps);

    await purgeExpired({ ...test.deps, now: () => new Date(test.deps.now().getTime() - 60 * 60 * 1000) });

    expect(calls.sessions).toHaveLength(2);
  });

  it("removes only expired sessions and guests", async () => {
    await test.users.createGuest({
      displayName: "alive",
      locale: "fr",
      expiresAt: new Date(test.deps.now().getTime() + 1000),
    });
    await test.users.createGuest({
      displayName: "dead",
      locale: "fr",
      expiresAt: new Date(test.deps.now().getTime() - 1000),
    });
    await test.users.createMember({ username: "alice", displayName: "Alice", passwordHash: "h", locale: "fr" });

    await purgeExpired(test.deps);

    expect(test.users.users.map((user) => user.displayName).sort()).toEqual(["Alice", "alive"]);
  });

  it("never throws, and still sets the throttle so a failing database is not hammered", async () => {
    let attempts = 0;
    test.sessions.deleteExpired = async () => {
      attempts += 1;
      throw new Error("db down");
    };

    await expect(purgeExpired(test.deps)).resolves.toBeUndefined();
    await purgeExpired(test.deps);

    expect(attempts).toBe(1);
  });

  it("resetPurgeThrottle allows an immediate new purge", async () => {
    const calls = instrument(test);
    await purgeExpired(test.deps);

    resetPurgeThrottle();
    await purgeExpired(test.deps);

    expect(calls.sessions).toHaveLength(2);
  });
});
