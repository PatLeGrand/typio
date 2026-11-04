// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoomStore, type RoomResult } from "./roomStore";
import { createPersistentRoomStore } from "./persistentRoomStore";
import { createMemoryRoomMembershipRepository } from "./roomMembershipRepository";

const host = { id: "host", kind: "member" as const, displayName: "Host" };
const guest = { id: "guest", kind: "guest" as const, displayName: "Guest" };
function code(result: RoomResult): string {
  if (!result.ok) throw new Error(result.error);
  return result.state.code;
}

function setup() {
  const memberships = createMemoryRoomMembershipRepository();
  const memory = createRoomStore();
  const store = createPersistentRoomStore(memory, memberships);
  return { memberships, memory, store };
}

describe("SALLE-06 persistent memberships", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reserves before exposing a room and accepts simultaneous tabs without a second insert", async () => {
    const { memberships, memory } = setup();
    let resume = () => {};
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    let inserts = 0;
    const store = createPersistentRoomStore(memory, {
      ...memberships,
      async reserve(...args) { inserts++; await gate; return memberships.reserve(...args); },
    });
    const creation = store.create(host, {}, "runner", 100);
    await Promise.resolve();
    expect(memory.roomOf(host.id)).toBeNull();
    resume();
    const room = code(await creation);
    const tabs = await Promise.all([store.join(guest, room, "runner", 200), store.join(guest, room, "runner", 300)]);
    expect(tabs.every((result) => result.ok)).toBe(true);
    expect(inserts).toBe(2);
    expect(store.get(room)?.participants).toHaveLength(2);
  });

  it("repairs an orphaned reservation for another room before admission", async () => {
    const { memberships, store } = setup();
    await memberships.reserve(host.id, "ZZZZZZ", new Date(100));
    const room = code(await store.create(host, {}, "runner", 200));
    expect(store.roomOf(host.id)).toBe(room);
    expect(await memberships.reserve(host.id, "BBBBBB", new Date())).toBe(false);
  });

  it.each(["create", "join"] as const)("keeps departure successful when release fails, then allows %s", async (admission) => {
    const { memberships, memory } = setup();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createPersistentRoomStore(memory, {
      ...memberships,
      async release() { throw new Error("database unavailable"); },
    });
    const room = code(await store.create(host, {}, "runner", 100));
    expect((await store.leave(host.id, room)).ok).toBe(true);
    expect(store.roomOf(host.id)).toBeNull();
    expect(logged).toHaveBeenCalledOnce();
    const target = code(await store.create({ ...host, id: "other" }, {}, "runner", 200));
    const result = admission === "create"
      ? await store.create(host, {}, "runner", 300)
      : await store.join(host, target, "runner", 300);
    expect(result.ok).toBe(true);
  });

  it("preserves a rejected admission when cleanup fails, then repairs the orphan", async () => {
    const { memberships, memory } = setup();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createPersistentRoomStore(memory, {
      ...memberships,
      async release() { throw new Error("database unavailable"); },
    });
    expect(await store.join(host, "ZZZZZZ", "runner", 100)).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    expect(store.roomOf(host.id)).toBeNull();
    expect(logged).toHaveBeenCalledOnce();
    expect((await store.create(host, {}, "runner", 200)).ok).toBe(true);
  });

  it("retries a conflicting reservation only once", async () => {
    const { memberships, memory } = setup();
    const reserve = vi.fn().mockResolvedValue(false);
    const store = createPersistentRoomStore(memory, { ...memberships, reserve });
    expect(await store.create(host, {}, "runner", 100)).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(store.roomOf(host.id)).toBeNull();
  });

  it("releases rejected admissions, departures and kicks", async () => {
    const { memberships, store } = setup();
    expect(await store.join(guest, "ZZZZZZ", "runner", 100)).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    const room = code(await store.create(host, {}, "runner", 100));
    expect((await store.join(guest, room, "runner", 200)).ok).toBe(true);
    await store.kick(host.id, room, guest.id);
    expect(await memberships.reserve(guest.id, "BBBBBB", new Date())).toBe(true);
    await store.leave(host.id, room);
    expect(await memberships.reserve(host.id, "BBBBBB", new Date())).toBe(true);
  });

  it.each(["leave", "expire"] as const)("SALLE-08: %s closes with only disconnected humans and bots remaining", async (departure) => {
    const { memberships, store } = setup();
    const room = code(await store.create(host, { bots: ["intermediate"] }, "runner", 100));
    const invite = store.createInvite(host.id, room);
    if (!invite.ok) throw new Error(invite.error);
    await store.joinInvite(guest, invite.token, "spectator", "ip", 200);
    store.disconnect(guest.id, room);
    if (departure === "expire") store.disconnect(host.id, room);
    expect(await store[departure](host.id, room)).toMatchObject({ ok: true, state: { status: "closed" } });
    expect(store.get(room)).toBeNull();
    expect(store.roomOf(guest.id)).toBeNull();
    expect(await store.joinInvite(guest, invite.token, "runner", "ip", 300)).toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(await memberships.reserve(guest.id, "BBBBBB", new Date())).toBe(true);
    expect(await memberships.reserve(host.id, "BBBBBB", new Date())).toBe(true);
  });

  it("releases all memberships on normal room closure", async () => {
    const { memberships, store, memory } = setup();
    const room = code(await store.create(host, {}, "runner", 100));
    await store.join(guest, room, "spectator", 200);
    memory.setStatus(room, "results");
    expect((await store.finish(host.id, room, true)).ok).toBe(true);
    expect(await memberships.reserve(guest.id, "BBBBBB", new Date())).toBe(true);
    expect(await memberships.reserve(host.id, "BBBBBB", new Date())).toBe(true);
  });

  it("does not expire a participant who reconnects while another reservation is pending", async () => {
    const { memberships, memory } = setup();
    let resume = () => {};
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    const store = createPersistentRoomStore(memory, {
      ...memberships,
      async reserve(...args) {
        if (args[0] === guest.id) await gate;
        return memberships.reserve(...args);
      },
    });
    const room = code(await store.create(host, {}, "runner", 100));
    store.disconnect(host.id, room);
    const joining = store.join(guest, room, "runner", 200);
    const expiry = store.expire(host.id, room);
    store.reconnect(host.id, room);
    resume();
    await joining;
    expect(await expiry).toEqual({ ok: false, error: "NOT_IN_ROOM" });
    expect(store.roomOf(host.id)).toBe(room);
    expect(store.get(room)?.hostId).toBe(host.id);
  });

  it("does not add a participant when persistence fails, and keeps the queue usable", async () => {
    const { memberships, memory } = setup();
    let failing = true;
    const store = createPersistentRoomStore(memory, {
      ...memberships,
      async reserve(...args) {
        if (failing) throw new Error("database unavailable");
        return memberships.reserve(...args);
      },
    });
    await expect(store.create(host, {}, "runner", 100)).rejects.toThrow("database unavailable");
    expect(store.roomOf(host.id)).toBeNull();
    failing = false;
    expect((await store.create(host, {}, "runner", 200)).ok).toBe(true);
  });
});
