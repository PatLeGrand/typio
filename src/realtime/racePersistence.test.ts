// @vitest-environment node
import { TEST_CORPUS } from "@/test/corpus";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaceRepository } from "@/race/raceRepository";
import type { Ack } from "./protocol";
import type { raceSnapshot } from "./raceEngine";
import type { RealtimeSocket } from "./roomHandlers";
import { createRealtimeServer } from "./server";
import { createFakeSessions } from "./testSupport";

// Frontière Socket.IO simulée : le serveur, ses gestionnaires et le moteur restent réels.
const transport = vi.hoisted(() => ({
  connection: undefined as ((socket: RealtimeSocket) => void) | undefined,
  broadcasts: [] as { event: string; payload: unknown }[],
}));
vi.mock("socket.io", () => ({
  Server: class {
    use() {}
    on(event: string, listener: (socket: RealtimeSocket) => void) {
      if (event === "connection") transport.connection = listener;
    }
    to() {
      return { emit: (event: string, payload: unknown) => transport.broadcasts.push({ event, payload }) };
    }
  },
}));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function client(id: string, kind: "member" | "guest") {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const received: { event: string; payload: unknown }[] = [];
  const socket = {
    id, data: { user: { id, kind, displayName: id }, roomCode: null },
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, [...handlers.get(event) ?? [], handler]);
    },
    emit(event: string, payload: unknown) { received.push({ event, payload }); }, join() {}, leave() {},
  } as unknown as RealtimeSocket;
  transport.connection!(socket);
  return {
    received,
    command(event: string, payload: unknown = {}): Promise<Ack<{ code: string }>> {
      return new Promise((resolve) => {
        for (const handler of handlers.get(event) ?? []) {
          if (event === "room:leave") handler(resolve);
          else handler(payload, resolve);
        }
      });
    },
    input(ops: string[]) {
      for (const handler of handlers.get("race:input") ?? []) handler({ ops });
    },
    disconnect() {
      for (const handler of handlers.get("disconnect") ?? []) handler();
    },
  };
}

describe("persistance RES-05", () => {
  it.each(["member", "guest"] as const)("solo %s: uses the result repository only for members", async (kind) => {
    vi.useFakeTimers();
    transport.broadcasts.length = 0;
    let time = 1000;
    const recordRace = vi.fn<RaceRepository["recordRace"]>(async () => ["solo"]);
    const server = createRealtimeServer({
      corpus: TEST_CORPUS, sessions: createFakeSessions().repository, allowedOrigins: [],
      now: () => new Date(time), generateSeed: () => 42, raceRepository: { recordRace },
    });
    try {
      const solo = client("solo", kind);
      const started = await solo.command("solo:start", { config: { length: 10 } });
      if (!started.ok) throw new Error(started.error);
      const snapshot = transport.broadcasts.find((b) => b.event === "race:state")!.payload as ReturnType<typeof raceSnapshot>;
      time = snapshot.startAt;
      for (let i = 0; i < snapshot.text.length; i += 10) {
        time += 1000;
        solo.input(snapshot.text.slice(i, i + 10).split(""));
      }
      await vi.advanceTimersByTimeAsync(0);
      expect(transport.broadcasts).toContainEqual({ event: "race:results", payload: expect.any(Array) });
      if (kind === "member") {
        expect(recordRace).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ roomCode: started.data.code, hostId: "solo", participantCount: 1 }),
          [expect.objectContaining({ userId: "solo", status: "finished", rank: 1 })],
        );
      } else expect(recordRace).not.toHaveBeenCalled();
    } finally { server.httpServer.emit("close"); }
  });

  it("écrit une fois à la dernière saisie, puis une seconde course distincte après relance et abandons", async () => {
    vi.useFakeTimers();
    transport.broadcasts.length = 0;
    let time = 1_000;
    const recordRace = vi.fn<RaceRepository["recordRace"]>(async () => ["member"]);
    const server = createRealtimeServer({
      corpus: TEST_CORPUS,
      sessions: createFakeSessions().repository, allowedOrigins: [],
      now: () => new Date(time), generateSeed: () => 42, raceRepository: { recordRace },
    });
    try {
      const host = client("member", "member");
      const other = client("other", "member");
      const created = (await host.command("room:create", { config: { length: 25 }, role: "runner" }));
      if (!created.ok) throw new Error(created.error);
      expect((await other.command("room:join", { code: created.data.code, role: "runner" })).ok).toBe(true);
      expect((await host.command("race:start")).ok).toBe(true);
      const snapshot = transport.broadcasts.find((b) => b.event === "race:state")!.payload as ReturnType<typeof raceSnapshot>;
      time = snapshot.startAt + 1_000;
      host.input([snapshot.text[0] === "x" ? "y" : "x", "\b"]);

      for (let i = 0; i < snapshot.text.length; i += 20) {
        time += 1_000;
        host.input(snapshot.text.slice(i, i + 20).split(""));
        other.input(snapshot.text.slice(i, i + 20).split(""));
        if (i + 20 < snapshot.text.length) expect(recordRace).not.toHaveBeenCalled();
      }
      await Promise.resolve();
      expect(recordRace).toHaveBeenCalledTimes(1);
      expect(host.received).toContainEqual({
        event: "race:self",
        payload: expect.objectContaining({ missedKeys: { [snapshot.text[0]]: 1 } }),
      });
      expect(other.received).toContainEqual({
        event: "race:self",
        payload: expect.objectContaining({ missedKeys: {} }),
      });
      const results = transport.broadcasts.find((message) => message.event === "race:results")!.payload;
      for (const row of results as object[]) expect(row).not.toHaveProperty("missedKeys");

      expect(recordRace.mock.calls[0][1].map((row) => row.status)).toEqual(["finished", "finished"]);
      await vi.advanceTimersByTimeAsync(0);
      expect(transport.broadcasts.filter((b) => b.event === "race:records")).toEqual([
        { event: "race:records", payload: { userIds: ["member"] } },
      ]);
      expect(transport.broadcasts.findIndex((b) => b.event === "race:records"))
        .toBeGreaterThan(transport.broadcasts.findIndex((b) => b.event === "race:results"));
      expect((await host.command("room:restart")).ok).toBe(true);
      time += 1_000;
      expect((await host.command("race:start")).ok).toBe(true);
      time += 5_000;
      expect((await host.command("race:abandon")).ok).toBe(true);
      expect(recordRace).toHaveBeenCalledTimes(1);
      expect((await other.command("race:abandon")).ok).toBe(true);
      await Promise.resolve();
      expect(recordRace).toHaveBeenCalledTimes(2);
      expect(recordRace.mock.calls[1][0].startedAt).not.toEqual(recordRace.mock.calls[0][0].startedAt);
      expect(recordRace.mock.calls[1][1].map((row) => row.status)).toEqual(["abandoned", "abandoned"]);
      client("member", "member");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(recordRace).toHaveBeenCalledTimes(2);
    } finally {
      server.httpServer.emit("close");
    }
  });

  it.each(["leave", "expire", "countdown", "guest"])("conserve l’écriture après suppression de la salle (%s)", async (mode) => {
    vi.useFakeTimers();
    transport.broadcasts.length = 0;
    let time = 1_000;
    const recordRace = vi.fn<RaceRepository["recordRace"]>(async () => []);
    const server = createRealtimeServer({
      corpus: TEST_CORPUS,
      sessions: createFakeSessions().repository, allowedOrigins: [], graceMs: 10,
      now: () => new Date(time), generateSeed: () => 42, raceRepository: { recordRace },
    });
    try {
      const host = client("member", "member");
      const created = (await host.command("room:create", { config: { length: 25, bots: ["intermediate"] },
        role: mode === "guest" ? "spectator" : "runner" }));
      if (!created.ok) throw new Error(created.error);
      const guest = mode === "guest" ? client("guest", "guest") : null;
      if (guest) expect((await guest.command("room:join", { code: created.data.code, role: "runner" })).ok).toBe(true);
      expect((await host.command("race:start")).ok).toBe(true);
      if (mode === "leave" || mode === "expire") {
        const snapshot = transport.broadcasts.find((b) => b.event === "race:state")!.payload as ReturnType<typeof raceSnapshot>;
        time = snapshot.startAt + 1_000;
        for (let i = 0; i < snapshot.text.length; i += 20) {
          time += 1_000;
          host.input(snapshot.text.slice(i, i + 20).split(""));
        }
      }
      expect(recordRace).not.toHaveBeenCalled();
      if (mode === "expire") host.disconnect();
      else expect((await host.command("room:leave")).ok).toBe(true);
      if (guest) expect((await guest.command("room:leave")).ok).toBe(true);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(recordRace).toHaveBeenCalledTimes(mode === "guest" ? 0 : 1);
      if (mode !== "guest") {
        expect(recordRace.mock.calls[0][0].endedAt).toEqual(new Date(time));
        expect(recordRace.mock.calls[0][1]).toEqual([expect.objectContaining({
          userId: "member", status: mode === "countdown" ? "abandoned" : "finished",
        })]);
      }
      await vi.advanceTimersByTimeAsync(700_000);
      expect(recordRace).toHaveBeenCalledTimes(mode === "guest" ? 0 : 1);
    } finally {
      server.httpServer.emit("close");
    }
  });

  it.each([false, true])("écrit une fois, membres seulement, et diffuse même si le dépôt échoue (%s)", async (fails) => {
    vi.useFakeTimers();
    transport.broadcasts.length = 0;
    let time = 1_000;
    const recordRace = vi.fn<RaceRepository["recordRace"]>(async () => {
      if (fails) throw new Error("database unavailable");
      return [];
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = createRealtimeServer({
      corpus: TEST_CORPUS,
      sessions: createFakeSessions().repository, allowedOrigins: [],
      now: () => new Date(time), generateSeed: () => 42, raceRepository: { recordRace },
    });
    try {
      const host = client("member", "member");
      const visitor = client("guest", "guest");
      const created = (await host.command("room:create", { config: { bots: ["intermediate"] }, role: "runner" }));
      if (!created.ok) throw new Error(created.error);
      const code = created.data.code;
      expect((await visitor.command("room:join", { code, role: "runner" }))).toMatchObject({ ok: true });
      expect((await host.command("race:start"))).toEqual({ ok: true });
      expect(recordRace).not.toHaveBeenCalled();
      time += 1_900_000;
      await vi.advanceTimersByTimeAsync(100);
      expect(transport.broadcasts.filter((b) => b.event === "race:results")).toEqual([
        { event: "race:results", payload: expect.arrayContaining([expect.objectContaining({ kind: "bot" })]) },
      ]);
      expect(recordRace).toHaveBeenCalledTimes(1);
      const [race, rows] = recordRace.mock.calls[0];
      expect(race).toMatchObject({ roomCode: code, hostId: "member", participantCount: 3 });
      expect(rows).toEqual([expect.objectContaining({ userId: "member", wpmSeries: expect.any(Array) })]);
      expect(rows[0]).not.toHaveProperty("typed");
      // La reconnexion aux résultats ne réécrit pas, même après un échec.
      client("member", "member");
      await vi.advanceTimersByTimeAsync(1_000);
      expect(recordRace).toHaveBeenCalledTimes(1);
      expect(transport.broadcasts.filter((b) => b.event === "race:results")).toHaveLength(1);
      if (fails) expect(log).toHaveBeenCalledWith("[realtime] race recording failed:", "Error: database unavailable");
    } finally {
      server.httpServer.emit("close");
    }
  });
});
