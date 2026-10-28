// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/auth/rateLimit";
import { registerRoomHandlers, type RealtimeSocket } from "./roomHandlers";
import { createRoomStore } from "./roomStore";
import { createUserSockets } from "./userSockets";
import type { GraceTimers } from "./graceTimers";
import type { RealtimeServer } from "./server";
import type { Ack } from "./protocol";

/** Frontières Socket.IO et minuteurs simulées ; store et moteur réels. */
function setup() {
  let time = 1000;
  const store = createRoomStore({ now: () => time, generateSeed: () => 42, generateCode: () => "ABCDEF" });
  const sockets = createUserSockets();
  const expirations = new Map<string, { delay: number; expire: () => void }>();
  const timers: GraceTimers = {
    arm(key, delay, expire) { expirations.set(key, { delay, expire }); },
    cancel(key) { expirations.delete(key); },
    close() { expirations.clear(); },
    get size() { return expirations.size; },
  };
  const broadcasts: { event: string; payload: unknown }[] = [];
  const io = { to: () => ({ emit: (event: string, payload: unknown) => broadcasts.push({ event, payload }) }) } as unknown as RealtimeServer;
  const raceInputs = createRateLimiter({ limit: 12, windowMs: 1000, now: () => time });
  const joinFailures = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => time });
  let counter = 0;
  function client(id: string) {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const received: { event: string; payload: unknown }[] = [];
    const rooms = new Set<string>();
    const socket = {
      id: String(++counter), data: { user: { id, kind: "member", displayName: id }, roomCode: null },
      on(event: string, handler: (...args: unknown[]) => void) { handlers.set(event, handler); },
      emit(event: string, payload: unknown) { received.push({ event, payload }); },
      join(code: string) { rooms.add(code); },
      leave(code: string) { rooms.delete(code); },
    } as unknown as RealtimeSocket;
    sockets.add(socket);
    registerRoomHandlers(io, socket, {
      now: () => new Date(time), store, sockets, timers, raceInputs, joinFailures,
      syncRace(code) {
        const snapshot = store.snapshot(code);
        if (snapshot) io.to(code).emit("race:state", snapshot);
      },
    });
    return {
      received, rooms,
      command(event: string, payload: unknown = {}): Ack {
        let result: Ack | undefined;
        const ack = (value: Ack) => { result = value; };
        if (event === "room:leave") handlers.get(event)?.(ack);
        else handlers.get(event)?.(payload, ack);
        if (!result) throw new Error(`Accusé absent : ${event}`);
        return result;
      },
      input(payload: unknown) { handlers.get("race:input")?.(payload); },
      disconnect() { sockets.remove(socket); handlers.get("disconnect")?.(); },
    };
  }
  const host = client("host");
  host.command("room:create", { config: { length: "short" } });
  const guest = client("guest");
  guest.command("room:join", { code: "ABCDEF", role: "runner" });
  return { store, host, guest, client, broadcasts, expirations, at: (value: number) => { time = value; } };
}

describe("frontière client des courses (COURSE-06)", () => {
  it("réserve le départ à l’hôte et diffuse le décompte sans l’état privé", () => {
    const { host, guest, broadcasts, store } = setup();
    expect(guest.command("race:start")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(host.command("race:start", { userId: "host" })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(host.command("race:start")).toEqual({ ok: true });
    expect(broadcasts.at(-1)).toMatchObject({ event: "race:state", payload: { status: "countdown" } });
    expect(store.get("ABCDEF")).not.toHaveProperty("race");
    expect(host.command("room:updateConfig", { botCount: 1 })).toEqual({ ok: false, error: "CONFIG_LOCKED" });
  });

  it("refuse les entrées invalides et impossibles uniquement à l’émetteur", () => {
    const { host, guest, store, at } = setup();
    host.command("race:start");
    host.input({ ops: ["a"] });
    expect(host.received.at(-1)).toEqual({ event: "room:error", payload: "RACE_NOT_RUNNING" });
    at(4000);
    for (const payload of [null, [], { ops: ["ab"] }, { ops: [""] }, { ops: Array(65).fill("a") }, { ops: ["a"], userId: "guest" }, { ops: Array(64).fill("a") }]) {
      host.input(payload);
      expect(host.received.at(-1)).toEqual({ event: "room:error", payload: "INPUT_REJECTED" });
    }
    expect(store.self("ABCDEF", "host")?.typed).toBe("");
    host.input({ ops: ["😀"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("😀");
    host.input({ ops: ["\b"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("");
    expect(guest.received).toEqual([]);
  });

  it("partage la limite de 12 messages/s entre onglets et ignore le treizième", () => {
    const { host, store, client, at } = setup();
    host.command("race:start");
    at(6000);
    const otherTab = client("host");
    for (let n = 0; n < 12; n++) (n % 2 ? host : otherTab).input({ ops: ["x"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("x".repeat(12));
    const count = host.received.length;
    host.input({ ops: ["x"] });
    expect(host.received.length).toBe(count);
    expect(store.self("ABCDEF", "host")?.typed).toBe("x".repeat(12));
    at(7000);
    host.input({ ops: ["x"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("x".repeat(13));
  });

  it("refuse les arrivées pendant la course et restaure la saisie aux seuls sockets du coureur", () => {
    const { host, guest, client, at, expirations } = setup();
    host.command("race:start");
    const newcomer = client("new");
    expect(newcomer.command("room:join", { code: "ABCDEF", role: "spectator" })).toEqual({ ok: false, error: "RACE_IN_PROGRESS" });
    at(6000);
    guest.input({ ops: ["x"] });
    guest.disconnect();
    expect(expirations.get("guest")?.delay).toBe(30_000);
    const reconnected = client("guest");
    expect(expirations.size).toBe(0);
    expect(reconnected.received.at(-1)).toEqual({ event: "race:self", payload: { typed: "x", keystrokes: { total: 1, correct: 0 } } });
    expect(host.received).toEqual([]);
  });

  it("abandonne après 30 s de grâce et ferme la salle sans humain", () => {
    const { host, guest, store, expirations, at } = setup();
    host.command("race:start");
    at(6000);
    guest.disconnect();
    at(36_000);
    expirations.get("guest")?.expire();
    expect(store.snapshot("ABCDEF")?.runners.find((r) => r.id === "guest")?.status).toBe("abandoned");
    expect(store.get("ABCDEF")?.participants.length).toBe(1);
    expect(host.command("room:leave")).toEqual({ ok: true });
    expect(store.get("ABCDEF")).toBeNull();
  });

  it("réserve relance et fermeture à l’hôte en résultats", () => {
    const { host, guest, client, store, at } = setup();
    expect(host.command("room:restart")).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    expect(host.command("room:close")).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    host.command("race:start");
    at(6000);
    expect(guest.command("race:abandon")).toEqual({ ok: true });
    expect(host.command("race:abandon")).toEqual({ ok: true });
    const newcomer = client("new");
    expect(newcomer.command("room:join", { code: "ABCDEF", role: "spectator" }).ok).toBe(true);
    expect(newcomer.received.at(-1)?.event).toBe("race:results");
    const returning = client("guest");
    expect(returning.received.at(-1)?.event).toBe("race:results");
    expect(guest.command("room:restart")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(guest.command("room:close")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(host.command("room:restart")).toEqual({ ok: true });
    expect(store.get("ABCDEF")?.participants.length).toBe(3);
    expect(host.command("room:updateConfig", { botCount: 1 })).toEqual({ ok: true });
    host.command("race:start");
    at(400_000);
    store.tick("ABCDEF");
    expect(host.command("room:close")).toEqual({ ok: true });
    expect(store.roomOf("guest")).toBeNull();
    expect(store.get("ABCDEF")).toBeNull();
    expect(host.rooms.size).toBe(0);
    expect(guest.rooms.size).toBe(0);
    expect(returning.rooms.size).toBe(0);
  });
});
