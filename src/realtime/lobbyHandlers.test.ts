// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/auth/rateLimit";
import type { GraceTimers } from "./graceTimers";
import { parseRoomConfigPatch, type Ack } from "./protocol";
import { LOBBY_ROOM, registerRoomHandlers, type RealtimeSocket } from "./roomHandlers";
import { createRoomStore } from "./roomStore";
import type { RealtimeServer } from "./server";
import { createUserSockets } from "./userSockets";

function setup() {
  const time = 1000;
  const codes = ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"];
  let next = 0;
  const store = createRoomStore({ now: () => time, generateCode: () => codes[next++] });
  const sockets = createUserSockets();
  const timers: GraceTimers = { arm() {}, cancel() {}, close() {}, get size() { return 0; } };
  const io = { to: () => ({ emit: () => undefined }) } as unknown as RealtimeServer;
  const raceInputs = createRateLimiter({ limit: 12, windowMs: 1000, now: () => time });
  const joinFailures = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => time });
  let changes = 0;
  let counter = 0;
  function client(id: string, kind: "member" | "guest" = "member") {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const received: { event: string; payload: unknown }[] = [];
    const rooms = new Set<string>();
    const socket = {
      id: String(++counter), data: { user: { id, kind, displayName: id }, roomCode: null },
      on(event: string, handler: (...args: unknown[]) => void) { handlers.set(event, handler); },
      emit(event: string, payload: unknown) { received.push({ event, payload }); },
      join(code: string) { rooms.add(code); },
      leave(code: string) { rooms.delete(code); },
    } as unknown as RealtimeSocket;
    sockets.add(socket);
    registerRoomHandlers(io, socket, {
      now: () => new Date(time), store, sockets, timers, raceInputs, joinFailures,
      syncRace: () => undefined, lobbyList: () => store.lobby(), lobbyChanged: () => { changes++; },
    });
    return {
      received, rooms,
      command(event: string, payload: unknown = {}): Ack<{ code: string }> {
        let result: Ack<{ code: string }> | undefined;
        handlers.get(event)?.(payload, (value: Ack<{ code: string }>) => { result = value; });
        if (!result) throw new Error(`Accusé absent : ${event}`);
        return result;
      },
    };
  }
  return { store, client, changes: () => changes };
}

describe("visibilité, partie rapide et explorateur (SALLE-03, JOIN-02, JOIN-03)", () => {
  it("valide visibilité et capacité dans le patch de configuration (TECH-07)", () => {
    expect(parseRoomConfigPatch({ visibility: "public", capacity: 2 })).toEqual({ visibility: "public", capacity: 2 });
    expect(parseRoomConfigPatch({ visibility: "hidden" })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 1 })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 31 })).toBeNull();
    expect(parseRoomConfigPatch({ capacity: 2.5 })).toBeNull();
  });

  it("refuse le code seul sur une salle privée avec INVITE_REQUIRED", () => {
    const { client } = setup();
    client("host").command("room:create", { config: { visibility: "private" } });
    expect(client("guest").command("room:join", { code: "AAAAAA", role: "runner" }))
      .toEqual({ ok: false, error: "INVITE_REQUIRED" });
  });

  it("partie rapide : choisit la salle la plus proche d'être pleine, sinon NO_ROOM_AVAILABLE", () => {
    const { client } = setup();
    expect(client("early").command("room:quickJoin")).toEqual({ ok: false, error: "NO_ROOM_AVAILABLE" });
    client("h1").command("room:create", { config: { visibility: "public" } });
    client("h2").command("room:create", { config: { visibility: "public", capacity: 3 } });
    client("h3").command("room:create", { config: { visibility: "code", capacity: 2 } });
    const player = client("player");
    expect(player.command("room:quickJoin")).toEqual({ ok: true, data: { code: "BBBBBB" } });
    expect(player.command("room:quickJoin")).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
    expect(client("bad").command("room:quickJoin", { code: "AAAAAA" })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
  });

  it("l'abonnement envoie la liste des salles publiques seulement, et se retire", () => {
    const { client, changes } = setup();
    client("h1").command("room:create", { config: { visibility: "public" } });
    client("h2").command("room:create", { config: { visibility: "code" } });
    const watcher = client("watcher", "guest");
    expect(watcher.command("lobby:subscribe")).toEqual({ ok: true });
    expect(watcher.rooms.has(LOBBY_ROOM)).toBe(true);
    const sent = watcher.received.find((message) => message.event === "lobby:rooms");
    expect(sent?.payload).toEqual([expect.objectContaining({ code: "AAAAAA", host: "h1" })]);
    expect(JSON.stringify(sent)).not.toContain("BBBBBB");
    expect(changes()).toBeGreaterThan(0);
    expect(watcher.command("lobby:subscribe", { extra: 1 })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(watcher.command("lobby:unsubscribe")).toEqual({ ok: true });
    expect(watcher.rooms.has(LOBBY_ROOM)).toBe(false);
  });
});
