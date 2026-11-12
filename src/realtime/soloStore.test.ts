// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TEST_CORPUS } from "@/test/corpus";
import { createRoomStore, type RoomResult } from "./roomStore";
import { createPersistentRoomStore } from "./persistentRoomStore";
import { createMemoryRoomMembershipRepository } from "./roomMembershipRepository";
import { toLobbyEntry } from "./lobby";

const member = { id: "member", kind: "member" as const, displayName: "Member" };
const guest = { id: "guest", kind: "guest" as const, displayName: "Guest" };
function state(result: RoomResult) {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function setup() {
  let time = 1000;
  let nextCode = 0;
  const memory = createRoomStore({
    corpus: TEST_CORPUS, now: () => time, generateSeed: () => 42,
    generateCode: () => ["ABCDEF", "BCDEFG", "CDEFGH"][nextCode++],
  });
  const memberships = createMemoryRoomMembershipRepository();
  const store = createPersistentRoomStore(memory, memberships);
  return { store, memberships, at: (value: number) => { time = value; } };
}

describe("salles solo (COURSE-06, COURSE-08)", () => {
  it("allows a guest solo with no bot, but preserves normal room restrictions", async () => {
    const { store } = setup();
    expect(await store.create(guest, {}, "runner", 1000)).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
    const solo = state(await store.startSolo(guest, {}, 1000));
    expect(solo).toMatchObject({ solo: true, status: "countdown", hostId: guest.id,
      config: { capacity: 1, visibility: "private", bots: [] },
      participants: [{ userId: guest.id, role: "runner" }],
    });
    expect(store.snapshot(solo.code)?.runners).toHaveLength(1);
    const normal = state(await store.create(member, {}, "runner", 1000));
    expect(store.start(member.id, normal.code)).toEqual({ ok: false, error: "NOT_ENOUGH_RUNNERS" });
    expect(await store.startSolo(member, {}, 1000)).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
    expect(store.roomOf(member.id)).toBe(normal.code);
  });

  it("denies outsiders and invitations, hides solos and locks their config and kicks", async () => {
    const { store } = setup();
    const solo = state(await store.startSolo(member, { bots: ["expert"] }, 1000));
    expect(solo.config.capacity).toBe(2);
    for (const role of ["runner", "spectator"] as const) {
      expect(await store.join(guest, solo.code, role, 1000)).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    }
    expect(store.createInvite(member.id, solo.code)).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    expect(await store.joinInvite(guest, "T".repeat(43), "runner", "ip", 1000))
      .toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(store.lobby()).toEqual([]);
    expect(store.quickJoinCode(guest.id)).toBeNull();
    expect(toLobbyEntry({ ...solo, config: { ...solo.config, visibility: "public" } }, 1000)).toBeNull();
    expect(store.updateConfig(member.id, solo.code, { bots: [] })).toEqual({ ok: false, error: "CONFIG_LOCKED" });
    expect(await store.kick(member.id, solo.code, guest.id)).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
  });

  it("serializes simultaneous solo starts, closes the previous room and releases memberships", async () => {
    const { store, memberships } = setup();
    const [first, second] = await Promise.all([
      store.startSolo(member, {}, 1000), store.startSolo(member, { length: 10 }, 1000),
    ]);
    const old = state(first), solo = state(second);
    expect(solo.code).not.toBe(old.code);
    expect(store.get(old.code)).toBeNull();
    expect(store.roomOf(member.id)).toBe(solo.code);
    expect(store.takeRecordings()).toHaveLength(1);
    expect(await memberships.reserve(member.id, "XXXXXX", new Date())).toBe(false);
    expect(state(await store.leave(member.id, solo.code)).status).toBe("closed");
    expect(await memberships.reserve(member.id, "XXXXXX", new Date())).toBe(true);
  });

  it.each([member, guest])("reconnects $kind, expires as abandoned, records members only", async (user) => {
    const { store, at, memberships } = setup();
    const solo = state(await store.startSolo(user, {}, 1000));
    const snapshot = store.snapshot(solo.code)!;
    at(snapshot.startAt + 1000);
    expect(store.input(user.id, solo.code, [snapshot.text[0]]).ok).toBe(true);
    store.disconnect(user.id, solo.code);
    expect(store.reconnect(user.id, solo.code).ok).toBe(true);
    expect(store.self(solo.code, user.id)?.typed).toBe(snapshot.text[0]);
    store.disconnect(user.id, solo.code);
    at(snapshot.startAt + 31_000);
    expect(state(await store.expire(user.id, solo.code)).status).toBe("closed");
    expect(store.get(solo.code)).toBeNull();
    const recordings = store.takeRecordings();
    if (user.kind === "member") {
      expect(recordings).toHaveLength(1);
      expect(recordings[0].rows).toMatchObject([{ userId: user.id, status: "abandoned" }]);
    } else expect(recordings).toEqual([]);
    expect(await memberships.reserve(user.id, "XXXXXX", new Date())).toBe(true);
  });

  it("restarts without bots and closes after results", async () => {
    const { store, at } = setup();
    const solo = state(await store.startSolo(member, {}, 1000));
    at(store.snapshot(solo.code)!.startAt + 1000);
    expect(store.abandon(member.id, solo.code).ok).toBe(true);
    expect(state(await store.finish(member.id, solo.code, false))).toMatchObject({ solo: true, status: "waiting" });
    expect(store.updateConfig(member.id, solo.code, { length: 10 })).toEqual({ ok: false, error: "CONFIG_LOCKED" });
    expect(state(store.start(member.id, solo.code)).status).toBe("countdown");
    at(store.snapshot(solo.code)!.startAt + 1000);
    store.abandon(member.id, solo.code);
    expect(state(await store.finish(member.id, solo.code, true)).status).toBe("closed");
    expect(store.roomOf(member.id)).toBeNull();
  });

  it("cleans up a failed start and repairs stale membership after a server restart", async () => {
    const { store, memberships } = setup();
    await memberships.reserve(member.id, "XXXXXX", new Date());
    expect(await store.startSolo(member, { excludedCharacters: "abcdefghijklmnopqrstuvwxyz" }, 1000))
      .toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
    expect(store.roomOf(member.id)).toBeNull();
    expect(store.get("ABCDEF")).toBeNull();
    expect(state(await store.startSolo(member, {}, 1000)).status).toBe("countdown");
  });
});
