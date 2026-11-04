// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/auth/rateLimit";
import type { GraceTimers } from "./graceTimers";
import { parseRoomConfigPatch, type Ack } from "./protocol";
import { LOBBY_ROOM, registerRoomHandlers, type RealtimeSocket } from "./roomHandlers";
import { createRoomStore } from "./roomStore";
import { createPersistentRoomStore } from "./persistentRoomStore";
import { createMemoryRoomMembershipRepository } from "./roomMembershipRepository";
import type { RealtimeServer } from "./server";
import { createUserSockets } from "./userSockets";

function setup() {
  let time = 1000;
  const codes = ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"];
  let next = 0;
  const store = createRoomStore({ now: () => time, generateCode: () => codes[next++] });
  const persistentStore = createPersistentRoomStore(store, createMemoryRoomMembershipRepository());
  const sockets = createUserSockets();
  const timers: GraceTimers = { arm() {}, cancel() {}, close() {}, get size() { return 0; } };
  const io = { to: () => ({ emit: () => undefined }) } as unknown as RealtimeServer;
  const raceInputs = createRateLimiter({ limit: 12, windowMs: 1000, now: () => time });
  const joinFailures = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => time });
  let changes = 0;
  let counter = 0;
  function client(id: string, kind: "member" | "guest" = "member", ip?: string) {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const received: { event: string; payload: unknown }[] = [];
    const rooms = new Set<string>();
    const socket = {
      id: String(++counter), data: { user: { id, kind, displayName: id }, roomCode: null, ip },
      on(event: string, handler: (...args: unknown[]) => void) { handlers.set(event, handler); },
      emit(event: string, payload: unknown) { received.push({ event, payload }); },
      join(code: string) { rooms.add(code); },
      leave(code: string) { rooms.delete(code); },
    } as unknown as RealtimeSocket;
    sockets.add(socket);
    registerRoomHandlers(io, socket, {
      now: () => new Date(time), store: persistentStore, sockets, timers, raceInputs, joinFailures,
      syncRace: () => undefined, lobbyList: () => store.lobby(), lobbyChanged: () => { changes++; },
    });
    return {
      received, rooms,
      command(event: string, payload: unknown = {}): Promise<Ack<{ code: string }>> {
        return new Promise((resolve) => {
          handlers.get(event)?.(payload, resolve);
        });
      },
    };
  }
  return { store, client, changes: () => changes, at: (value: number) => { time = value; } };
}

describe("visibilité, partie rapide et explorateur (SALLE-03, JOIN-02, JOIN-03)", () => {
  it("valide visibilité et capacité dans le patch de configuration (TECH-07)", () => {
    expect(parseRoomConfigPatch({ visibility: "public", capacity: 2 })).toEqual({ visibility: "public", capacity: 2 });
    expect(parseRoomConfigPatch({ visibility: "hidden" })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 1 })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 31 })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 2.5 })).toBeNull();
  });

  it("refuse le code seul sur une salle privée avec INVITE_REQUIRED", async () => {
    const { client } = setup();
    await client("host").command("room:create", { config: { visibility: "private" } });
    expect(await client("guest").command("room:join", { code: "AAAAAA", role: "runner" }))
      .toEqual({ ok: false, error: "INVITE_REQUIRED" });
  });

  it("partie rapide : choisit la salle la plus proche d'être pleine, sinon NO_ROOM_AVAILABLE", async () => {
    const { client } = setup();
    expect(await client("early").command("room:quickJoin")).toEqual({ ok: false, error: "NO_ROOM_AVAILABLE" });
    await client("h1").command("room:create", { config: { visibility: "public" } });
    await client("h2").command("room:create", { config: { visibility: "public", capacity: 3 } });
    await client("h3").command("room:create", { config: { visibility: "code", capacity: 2 } });
    const player = client("player");
    expect(await player.command("room:quickJoin")).toEqual({ ok: true, data: { code: "BBBBBB" } });
    expect(await player.command("room:quickJoin")).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
    expect(await client("bad").command("room:quickJoin", { code: "AAAAAA" })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
  });

  it("l'abonnement envoie la liste des salles publiques seulement, et se retire", async () => {
    const { client, changes } = setup();
    await client("h1").command("room:create", { config: { visibility: "public" } });
    await client("h2").command("room:create", { config: { visibility: "code" } });
    const watcher = client("watcher", "guest");
    expect(await watcher.command("lobby:subscribe")).toEqual({ ok: true });
    expect(watcher.rooms.has(LOBBY_ROOM)).toBe(true);
    const sent = watcher.received.find((message) => message.event === "lobby:rooms");
    expect(sent?.payload).toEqual([expect.objectContaining({ code: "AAAAAA", host: "h1" })]);
    expect(JSON.stringify(sent)).not.toContain("BBBBBB");
    expect(changes()).toBeGreaterThan(0);
    expect(await watcher.command("lobby:subscribe", { extra: 1 })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await watcher.command("lobby:unsubscribe")).toEqual({ ok: true });
    expect(watcher.rooms.has(LOBBY_ROOM)).toBe(false);
  });
});

describe("SALLE-10: IP brute-force protection without network I/O", () => {
  it("counts parallel failures across accounts, preserves the user limit, and expires after one minute", async () => {
    const { client, at } = setup();
    await client("host").command("room:create", { config: {} });
    const first = client("first", "guest", "192.0.2.1");
    const second = client("second", "guest", "192.0.2.1");
    const otherIp = client("other", "guest", "192.0.2.2");
    const failures = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? first : second).command("room:join", { code: "ZZZZZZ", role: "runner" })));
    expect(failures.filter((result) => !result.ok && result.error === "ROOM_NOT_FOUND")).toHaveLength(10);
    expect(failures.filter((result) => !result.ok && result.error === "INVALID_CODE")).toHaveLength(2);
    expect(await second.command("room:join", { code: "AAAAAA", role: "runner" })).toEqual({ ok: false, error: "INVALID_CODE" });
    expect(await otherIp.command("room:join", { code: "AAAAAA", role: "runner" })).toEqual({ ok: true, data: { code: "AAAAAA" } });
    at(61_001);
    expect(await first.command("room:join", { code: "AAAAAA", role: "runner" })).toEqual({ ok: true, data: { code: "AAAAAA" } });
  });

  it("falls back to separate user keys when the IP is absent or unknown", async () => {
    const { client } = setup();
    await client("host").command("room:create", { config: {} });
    for (const ip of [undefined, "unknown"]) {
      const attacker = client(`attacker-${ip}`, "guest", ip);
      for (let i = 0; i < 10; i++) await attacker.command("room:join", { code: "bad", role: "runner" });
      expect(await attacker.command("room:join", { code: "AAAAAA", role: "runner" })).toEqual({ ok: false, error: "INVALID_CODE" });
      expect(await client(`innocent-${ip}`, "guest", ip).command("room:join", { code: "AAAAAA", role: "runner" })).toEqual({ ok: true, data: { code: "AAAAAA" } });
    }
  });
});
