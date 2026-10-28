// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RaceRepository } from "@/race/raceRepository";
import type { Ack } from "./protocol";
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
  const socket = {
    id, data: { user: { id, kind, displayName: id }, roomCode: null },
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, [...handlers.get(event) ?? [], handler]);
    },
    emit() {}, join() {}, leave() {},
  } as unknown as RealtimeSocket;
  transport.connection!(socket);
  return {
    command(event: string, payload: unknown = {}): Ack<{ code: string }> {
      let result: Ack<{ code: string }> | undefined;
      for (const handler of handlers.get(event) ?? []) handler(payload, (ack: typeof result) => { result = ack; });
      if (!result) throw new Error(`Accusé absent : ${event}`);
      return result;
    },
  };
}

describe("persistance RES-05", () => {
  it.each([false, true])("écrit une fois, membres seulement, et diffuse même si le dépôt échoue (%s)", async (fails) => {
    vi.useFakeTimers();
    transport.broadcasts.length = 0;
    let time = 1_000;
    const recordRace = vi.fn<RaceRepository["recordRace"]>(async () => {
      if (fails) throw new Error("database unavailable");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const server = createRealtimeServer({
      sessions: createFakeSessions().repository, allowedOrigins: [],
      now: () => new Date(time), generateSeed: () => 42, raceRepository: { recordRace },
    });
    try {
      const host = client("member", "member");
      const visitor = client("guest", "guest");
      const created = host.command("room:create", { config: { botCount: 1 }, role: "runner" });
      if (!created.ok) throw new Error(created.error);
      const code = created.data.code;
      expect(visitor.command("room:join", { code, role: "runner" })).toMatchObject({ ok: true });
      expect(host.command("race:start")).toEqual({ ok: true });
      expect(recordRace).not.toHaveBeenCalled();
      time += 700_000;
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
