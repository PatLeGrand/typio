// @vitest-environment node
import { TEST_CORPUS } from "@/test/corpus";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_CORPUS, type SentenceCorpus } from "@/race/textGenerator";
import { createRateLimiter } from "@/auth/rateLimit";
import { registerRoomHandlers, type RealtimeSocket } from "./roomHandlers";
import { createRoomStore } from "./roomStore";
import { createPersistentRoomStore } from "./persistentRoomStore";
import { createMemoryRoomMembershipRepository } from "./roomMembershipRepository";
import { createUserSockets } from "./userSockets";
import type { GraceTimers } from "./graceTimers";
import type { RealtimeServer } from "./server";
import type { Ack } from "./protocol";

/** Frontières Socket.IO et minuteurs simulées ; store et moteur réels. */
async function setup(loadCorpus?: () => Promise<SentenceCorpus>, initialRoom = true) {
  let time = 1000;
  let codeIndex = 0;
  const store = createRoomStore({ corpus: TEST_CORPUS, now: () => time, generateSeed: () => 42,
    generateCode: () => ["ABCDEF", "BCDEFG", "CDEFGH"][codeIndex++] });
  const persistentStore = createPersistentRoomStore(store, createMemoryRoomMembershipRepository());
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
      now: () => new Date(time), store: persistentStore, sockets, timers, raceInputs, joinFailures, loadCorpus,
      syncRace(code) {
        const snapshot = store.snapshot(code);
        if (snapshot) io.to(code).emit("race:state", snapshot);
      },
      lobbyList: () => store.lobby(),
      lobbyChanged: () => undefined,
    });
    return {
      received, rooms,
      command(event: string, payload: unknown = {}): Promise<Ack> {
        return new Promise((resolve) => {
          if (event === "room:leave") handlers.get(event)?.(resolve);
          else handlers.get(event)?.(payload, resolve);
        });
      },
      commandAsync(event: string): Promise<Ack> {
        return new Promise((resolve) => handlers.get(event)?.({}, resolve));
      },
      input(payload: unknown) { handlers.get("race:input")?.(payload); },
      disconnect() { sockets.remove(socket); handlers.get("disconnect")?.(); },
    };
  }
  const host = client("host");
  if (initialRoom) await host.command("room:create", { config: { length: 25 } });
  const guest = client("guest");
  if (initialRoom) await guest.command("room:join", { code: "ABCDEF", role: "runner" });
  return { store, host, guest, client, broadcasts, expirations, at: (value: number) => { time = value; } };
}

describe("frontière client des courses (COURSE-06)", () => {
  it("solo:start validates, allows guests and prevents all outside entry paths", async () => {
    const { client, guest, store, broadcasts } = await setup(undefined, false);
    const solo = client("solo-guest", "guest");
    expect(await solo.command("solo:start", { config: { capacity: 1 } })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(store.roomOf("solo-guest")).toBeNull();
    expect(await solo.command("room:create")).toEqual({ ok: false, error: "GUEST_CANNOT_CREATE" });
    expect(await solo.command("solo:start")).toEqual({ ok: true, data: { code: "ABCDEF" } });
    expect(solo.rooms).toEqual(new Set(["ABCDEF"]));
    expect(broadcasts.at(-1)).toMatchObject({ event: "race:state", payload: { status: "countdown" } });
    expect(await guest.command("room:join", { code: "ABCDEF", role: "spectator" })).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    expect(await guest.command("room:joinInvite", { token: "T".repeat(43), role: "runner" })).toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(await guest.command("room:quickJoin")).toEqual({ ok: false, error: "NO_ROOM_AVAILABLE" });
    expect(await solo.command("room:createInvite")).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    expect(store.lobby()).toEqual([]);
  });

  it("solo:start replaces the room across tabs and preserves the 30 s reconnect grace", async () => {
    const { host, client, store, expirations, at } = await setup(undefined, false);
    await host.command("solo:start");
    const tab = client("host");
    expect(tab.rooms).toEqual(new Set(["ABCDEF"]));
    expect(store.get("ABCDEF")?.solo).toBe(true);
    expect(await tab.command("solo:start")).toEqual({ ok: true, data: { code: "BCDEFG" } });
    expect(store.get("ABCDEF")).toBeNull();
    expect(host.rooms).toEqual(new Set(["BCDEFG"]));
    expect(tab.rooms).toEqual(new Set(["BCDEFG"]));
    host.disconnect();
    tab.disconnect();
    expect(expirations.get("host")?.delay).toBe(30_000);
    const resumed = client("host");
    expect(expirations.has("host")).toBe(false);
    expect(resumed.received).toContainEqual({ event: "race:self", payload: expect.objectContaining({ typed: "" }) });
    resumed.disconnect();
    at(31_000);
    await expirations.get("host")!.expire();
    expect(store.get("BCDEFG")).toBeNull();
    expect(store.roomOf("host")).toBeNull();
  });

  it("solo:start refuses an existing normal room and handles corpus failures without creating a room", async () => {
    const loadCorpus = vi.fn(async () => { throw new Error("unavailable"); });
    const { host, client, store } = await setup(loadCorpus);
    expect(await host.command("solo:start")).toEqual({ ok: false, error: "ALREADY_IN_ROOM" });
    expect(loadCorpus).not.toHaveBeenCalled();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await client("solo").command("solo:start")).toEqual({ ok: false, error: "INTERNAL" });
      expect(store.roomOf("solo")).toBeNull();
      expect(store.roomOf("host")).toBe("ABCDEF");
    } finally { log.mockRestore(); }
  });

  it("clears the old solo in every tab if the replacement has no available text", async () => {
    const { host, client, store } = await setup(undefined, false);
    await host.command("solo:start");
    const tab = client("host");
    expect(await host.command("solo:start", { config: { excludedCharacters: "abcdefghijklmnopqrstuvwxyz" } }))
      .toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
    expect(store.roomOf("host")).toBeNull();
    expect(host.rooms.size).toBe(0);
    expect(tab.rooms.size).toBe(0);
    for (const socket of [host, tab]) {
      expect(socket.received).toContainEqual({ event: "room:state", payload: expect.objectContaining({ status: "closed" }) });
    }
  });

  it("réserve le départ à l’hôte et diffuse le décompte sans l’état privé", async () => {
    const { host, guest, broadcasts, store } = await setup();
    expect(await guest.command("race:start")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(await host.command("race:start", { userId: "host" })).toEqual({ ok: false, error: "INVALID_PAYLOAD" });
    expect(await host.command("race:start")).toEqual({ ok: true });
    expect(broadcasts.at(-1)).toMatchObject({ event: "race:state", payload: { status: "countdown" } });
    expect(store.get("ABCDEF")).not.toHaveProperty("race");
    expect(await host.command("room:updateConfig", { bots: ["intermediate"] })).toEqual({ ok: false, error: "CONFIG_LOCKED" });
  });

  it("refuse les entrées invalides et impossibles uniquement à l’émetteur", async () => {
    const { host, guest, store, at } = await setup();
    await host.command("race:start");
    host.input({ ops: ["a"] });
    expect(host.received.slice(-2)).toEqual([
      { event: "room:error", payload: "RACE_NOT_RUNNING" },
      { event: "race:self", payload: store.self("ABCDEF", "host") },
    ]);
    at(4000);
    for (const payload of [null, [], { ops: ["ab"] }, { ops: ["😀"] }, { ops: [""] }, { ops: Array(65).fill("a") }, { ops: ["a"], userId: "guest" }]) {
      host.input(payload);
      expect(host.received.at(-1)).toEqual({ event: "room:error", payload: "INPUT_REJECTED" });
    }
    expect(store.self("ABCDEF", "host")?.typed).toBe("");
    host.input({ ops: ["\uD83D", "\uDE00"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("😀");
    host.input({ ops: Array(64).fill("a") });
    expect(host.received.slice(-2)).toEqual([
      { event: "room:error", payload: "INPUT_REJECTED" },
      { event: "race:self", payload: { typed: "😀", keystrokes: { total: 2, correct: 0 } } },
    ]);
    host.input({ ops: ["\b"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("\uD83D");
    host.input({ ops: ["\b"] });
    expect(store.self("ABCDEF", "host")?.typed).toBe("");
    expect(guest.received).toEqual([]);
  });

  it("partage la limite de 12 messages/s entre onglets et ignore le treizième", async () => {
    const { host, store, client, at } = await setup();
    await host.command("race:start");
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

  it("refuse les arrivées pendant la course et restaure la saisie aux seuls sockets du coureur", async () => {
    const { host, guest, client, at, expirations } = await setup();
    await host.command("race:start");
    const newcomer = client("new");
    expect(await newcomer.command("room:join", { code: "ABCDEF", role: "spectator" })).toEqual({ ok: false, error: "RACE_IN_PROGRESS" });
    at(6000);
    guest.input({ ops: ["x"] });
    guest.disconnect();
    expect(expirations.get("guest")?.delay).toBe(30_000);
    const reconnected = client("guest");
    expect(expirations.size).toBe(0);
    expect(reconnected.received.at(-1)).toEqual({ event: "race:self", payload: { typed: "x", keystrokes: { total: 1, correct: 0 } } });
    expect(host.received).toEqual([]);
  });

  it("reprend les résultats sans divulguer les touches manquées des autres coureurs", async () => {
    const { host, guest, client, store, at } = await setup();
    await host.command("race:start");
    at(6000);
    const expected = store.snapshot("ABCDEF")!.text[0];
    guest.input({ ops: [expected === "x" ? "y" : "x"] });
    await guest.command("race:abandon");
    await host.command("race:abandon");
    guest.disconnect();
    const returning = client("guest");
    const reloaded = client("guest");
    for (const socket of [returning, reloaded]) {
      expect(socket.received).toContainEqual({
        event: "race:self",
        payload: expect.objectContaining({ missedKeys: { [expected]: 1 } }),
      });
      const results = socket.received.find((message) => message.event === "race:results")!.payload;
      for (const row of results as object[]) expect(row).not.toHaveProperty("missedKeys");
    }
    const spectator = client("spectator");
    await spectator.command("room:join", { code: "ABCDEF", role: "spectator" });
    expect(spectator.received.some((message) => message.event === "race:self")).toBe(false);
    expect(host.received.some((message) => JSON.stringify(message.payload).includes("missedKeys"))).toBe(false);
  });

  it("abandonne après 30 s de grâce et ferme la salle sans humain", async () => {
    const { host, guest, store, expirations, at } = await setup();
    await host.command("race:start");
    at(6000);
    guest.disconnect();
    at(36_000);
    await expirations.get("guest")?.expire();
    expect(store.snapshot("ABCDEF")?.runners.find((r) => r.id === "guest")?.status).toBe("abandoned");
    expect(store.get("ABCDEF")?.participants.length).toBe(1);
    expect(await host.command("room:leave")).toEqual({ ok: true });
    expect(store.get("ABCDEF")).toBeNull();
  });

  it.each(["room:restart", "room:close"] as const)("autorise l’hôte promu après expiration de la grâce à exécuter %s en résultats", async (event) => {
    const { host, guest, store, expirations, broadcasts, at } = await setup();
    expect(await host.command("race:start")).toEqual({ ok: true });
    at(6000);
    host.disconnect();
    expect(expirations.get("host")?.delay).toBe(30_000);
    at(36_000);
    await expirations.get("host")!.expire();
    expect(store.get("ABCDEF")).toMatchObject({ hostId: "guest", status: "racing" });
    expect(store.snapshot("ABCDEF")?.runners.find((r) => r.id === "host")?.status).toBe("abandoned");
    expect(store.roomOf("host")).toBeNull();
    expect(await guest.command("race:abandon")).toEqual({ ok: true });
    expect(store.get("ABCDEF")?.status).toBe("results");
    expect(await guest.command(event)).toEqual({ ok: true });
    if (event === "room:restart") {
      expect(store.get("ABCDEF")).toMatchObject({ hostId: "guest", status: "waiting" });
      expect(store.snapshot("ABCDEF")).toBeNull();
      expect(guest.rooms.has("ABCDEF")).toBe(true);
    } else {
      expect(store.get("ABCDEF")).toBeNull();
      expect(store.roomOf("guest")).toBeNull();
      expect(guest.rooms.size).toBe(0);
      expect(broadcasts).toContainEqual({ event: "room:state", payload: expect.objectContaining({ status: "closed" }) });
    }
  });

  it.each(["leave", "expire"] as const)("SALLE-08: %s closes with an offline participant and cancels their grace timer", async (departure) => {
    const { host, guest, client, store, expirations, broadcasts } = await setup();
    guest.disconnect();
    expect(expirations.has("guest")).toBe(true);
    if (departure === "leave") {
      expect(await host.command("room:leave")).toEqual({ ok: true });
    } else {
      host.disconnect();
      const expiry = expirations.get("host")!.expire;
      expirations.delete("host"); // le vrai minuteur se retire avant le rappel
      await expiry();
    }
    expect(store.get("ABCDEF")).toBeNull();
    expect(store.roomOf("guest")).toBeNull();
    expect(expirations.size).toBe(0);
    expect(broadcasts).toContainEqual({ event: "room:state", payload: expect.objectContaining({ status: "closed" }) });
    expect(client("guest").received).toEqual([]);
  });

  it("réserve relance et fermeture à l’hôte en résultats", async () => {
    const { host, guest, client, store, at } = await setup();
    expect(await host.command("room:restart")).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    expect(await host.command("room:close")).toEqual({ ok: false, error: "RACE_NOT_ALLOWED" });
    await host.command("race:start");
    at(6000);
    expect(await guest.command("race:abandon")).toEqual({ ok: true });
    expect(await host.command("race:abandon")).toEqual({ ok: true });
    const newcomer = client("new");
    expect((await newcomer.command("room:join", { code: "ABCDEF", role: "spectator" })).ok).toBe(true);
    expect(newcomer.received.at(-1)?.event).toBe("race:results");
    const returning = client("guest");
    expect(returning.received.at(-1)?.event).toBe("race:results");
    expect(await guest.command("room:restart")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(await guest.command("room:close")).toEqual({ ok: false, error: "NOT_HOST" });
    expect(await host.command("room:restart")).toEqual({ ok: true });
    expect(store.get("ABCDEF")?.participants.length).toBe(3);
    expect(await host.command("room:updateConfig", { bots: ["intermediate"] })).toEqual({ ok: true });
    await host.command("race:start");
    at(1_900_000);
    store.tick("ABCDEF");
    expect(await host.command("room:close")).toEqual({ ok: true });
    expect(store.roomOf("guest")).toBeNull();
    expect(store.get("ABCDEF")).toBeNull();
    expect(host.rooms.size).toBe(0);
    expect(guest.rooms.size).toBe(0);
    expect(returning.rooms.size).toBe(0);
  });
});

it("charge le corpus avant chaque départ et réessaie après un seed tardif", async () => {
  const load = vi.fn<() => Promise<SentenceCorpus>>().mockResolvedValueOnce(EMPTY_CORPUS).mockResolvedValue(TEST_CORPUS);
  const { host, store } = await setup(load);
  expect(load).not.toHaveBeenCalled();
  expect(await host.commandAsync("race:start")).toEqual({ ok: false, error: "NO_TEXT_AVAILABLE" });
  expect(store.get("ABCDEF")?.status).toBe("waiting");
  expect(await host.commandAsync("race:start")).toEqual({ ok: true });
  expect(store.get("ABCDEF")?.status).toBe("countdown");
  expect(load).toHaveBeenCalledTimes(2);
});
