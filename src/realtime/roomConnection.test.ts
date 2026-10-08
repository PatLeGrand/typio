import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ROOM_CONFIG, MAX_RUNNERS, type Participant, type RoomState } from "./protocol";
import type { RoomSocket } from "./client";
import {
  ACK_TIMEOUT_MS,
  createRoomConnection,
  RESYNC_TIMEOUT_MS,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  roomForUser,
  type RoomConnection,
} from "./roomConnection";

type Handler = (...args: unknown[]) => void;

interface Emission {
  event: string;
  args: unknown[];
  timeoutMs: number;
  ack: (error: Error | null, response?: unknown) => void;
}

/** Socket minimal : enregistre les écouteurs et les émissions, le test joue le serveur. */
class FakeSocket {
  connected = false;
  active = true;
  emissions: Emission[] = [];
  connect = vi.fn();
  disconnect = vi.fn(() => {
    this.connected = false;
  });
  private handlers = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): this {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(event, set);
    return this;
  }

  off(event: string, handler: Handler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  timeout(timeoutMs: number) {
    return {
      emit: (event: string, ...args: unknown[]) => {
        const ack = args.pop() as Emission["ack"];
        this.emissions.push({ event, args, timeoutMs, ack });
      },
    };
  }

  fire(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }

  listenerCount(): number {
    return [...this.handlers.values()].reduce((total, set) => total + set.size, 0);
  }

  /** Connexion réussie côté serveur. */
  open(): void {
    this.connected = true;
    this.fire("connect");
  }
}

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function participant(userId: string, overrides: Partial<Participant> = {}): Participant {
  return {
    userId,
    displayName: userId === ME ? "Alice" : "Bob",
    kind: "member",
    role: "runner",
    connected: true,
    joinedAt: 1,
    ...overrides,
  };
}

function roomState(userIds: string[], code = "ABC234"): RoomState {
  return {
    code,
    status: "waiting",
    hostId: userIds[0] ?? ME,
    config: DEFAULT_ROOM_CONFIG,
    participants: userIds.map((id) => participant(id)),
    maxRunners: MAX_RUNNERS,
  };
}

let socket: FakeSocket;
let connection: RoomConnection;

function startConnected(): void {
  connection.start(ME);
  socket.open();
}

beforeEach(() => {
  vi.useFakeTimers();
  socket = new FakeSocket();
  connection = createRoomConnection(() => socket as unknown as RoomSocket);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("roomForUser", () => {
  it("garde l'état quand l'utilisateur y figure", () => {
    const state = roomState([ME, OTHER]);
    expect(roomForUser(state, ME)).toBe(state);
  });

  it("renvoie null quand l'utilisateur n'y figure plus (il a quitté, D3)", () => {
    expect(roomForUser(roomState([OTHER]), ME)).toBeNull();
  });
});

describe("connexion", () => {
  it("ne fait rien avant start() : état inactif, aucun socket sollicité", () => {
    expect(connection.getSnapshot()).toEqual({ connection: "idle", room: null, error: null });
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("start() connecte le socket une seule fois pour le même utilisateur", () => {
    connection.start(ME);
    connection.start(ME);

    expect(connection.getSnapshot().connection).toBe("connecting");
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("start() reste inactif quand il n'y a pas de socket (rendu serveur)", () => {
    const serverSide = createRoomConnection(() => null);
    serverSide.start(ME);
    expect(serverSide.getSnapshot().connection).toBe("idle");
  });

  it("passe à connected à la connexion et à offline à la coupure", () => {
    startConnected();
    expect(connection.getSnapshot().connection).toBe("connected");

    socket.connected = false;
    socket.fire("disconnect", "transport close");
    expect(connection.getSnapshot().connection).toBe("offline");
  });

  it("serveur coupant la connexion : relance après le délai (Socket.IO ne le fait pas seul)", () => {
    startConnected();
    socket.fire("disconnect", "io server disconnect");
    expect(socket.connect).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(RETRY_BASE_MS);
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });

  it("coupure réseau : Socket.IO se reconnecte seul, pas de relance manuelle", () => {
    startConnected();
    socket.fire("disconnect", "transport close");
    vi.advanceTimersByTime(RETRY_MAX_MS * 2);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("changer d'utilisateur coupe l'ancienne session et se reconnecte à neuf", () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    expect(connection.getSnapshot().room).not.toBeNull();

    connection.start(OTHER);

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    expect(connection.getSnapshot()).toEqual({ connection: "connecting", room: null, error: null });
    expect(socket.listenerCount()).toBe(5);
  });
});

describe("connect_error (D9)", () => {
  it("UNAUTHENTICATED : état unauthenticated, aucune nouvelle tentative", () => {
    connection.start(ME);
    socket.active = false;
    socket.fire("connect_error", new Error("UNAUTHENTICATED"));

    expect(connection.getSnapshot().connection).toBe("unauthenticated");
    vi.advanceTimersByTime(RETRY_MAX_MS * 2);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });

  it("refus du middleware (INTERNAL) : bandeau hors ligne puis relance avec délai croissant", () => {
    connection.start(ME);
    socket.active = false;

    socket.fire("connect_error", new Error("INTERNAL"));
    expect(connection.getSnapshot().connection).toBe("offline");
    vi.advanceTimersByTime(RETRY_BASE_MS - 1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);

    socket.fire("connect_error", new Error("INTERNAL"));
    vi.advanceTimersByTime(RETRY_BASE_MS * 2);
    expect(socket.connect).toHaveBeenCalledTimes(3);
  });

  it("le délai de relance plafonne à RETRY_MAX_MS", () => {
    connection.start(ME);
    socket.active = false;
    for (let i = 0; i < 8; i++) {
      socket.fire("connect_error", new Error("INTERNAL"));
      vi.advanceTimersByTime(RETRY_MAX_MS);
    }
    const before = socket.connect.mock.calls.length;
    socket.fire("connect_error", new Error("INTERNAL"));
    vi.advanceTimersByTime(RETRY_MAX_MS);
    expect(socket.connect).toHaveBeenCalledTimes(before + 1);
  });

  it("erreur de transport (Socket.IO réessaie seul) : pas de relance manuelle", () => {
    connection.start(ME);
    socket.active = true;
    socket.fire("connect_error", new Error("xhr poll error"));

    expect(connection.getSnapshot().connection).toBe("offline");
    vi.advanceTimersByTime(RETRY_MAX_MS * 2);
    expect(socket.connect).toHaveBeenCalledTimes(1);
  });
});

describe("état de la salle", () => {
  it("mémorise l'état reçu et efface l'erreur précédente", () => {
    startConnected();
    socket.fire("room:error", "ROOM_FULL");
    expect(connection.getSnapshot().error).toBe("ROOM_FULL");

    const state = roomState([ME, OTHER]);
    socket.fire("room:state", state);

    expect(connection.getSnapshot().room).toBe(state);
    expect(connection.getSnapshot().error).toBeNull();
  });

  it("un état où l'utilisateur n'apparaît pas donne null", () => {
    startConnected();
    socket.fire("room:state", roomState([ME, OTHER]));
    socket.fire("room:state", roomState([OTHER]));

    expect(connection.getSnapshot().room).toBeNull();
  });

  it("prévient les abonnés à chaque changement, pas quand rien ne change", () => {
    const listener = vi.fn();
    const unsubscribe = connection.subscribe(listener);
    const before = connection.getSnapshot();

    connection.clearError();
    expect(listener).not.toHaveBeenCalled();
    expect(connection.getSnapshot()).toBe(before);

    connection.start(ME);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    socket.open();
    expect(listener).not.toHaveBeenCalled();
  });

  it("le snapshot serveur reste inactif", () => {
    startConnected();
    expect(connection.getServerSnapshot()).toEqual({ connection: "idle", room: null, error: null });
  });
});

describe("reconnexion avec une salle (SALLE-13)", () => {
  function reconnect(): void {
    socket.connected = false;
    socket.fire("disconnect", "transport close");
    socket.open();
  }

  it("garde la salle affichée et la remplace par l'état renvoyé par le serveur", () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    reconnect();
    expect(connection.getSnapshot().room).not.toBeNull();

    const fresh = roomState([ME, OTHER]);
    socket.fire("room:state", fresh);
    vi.advanceTimersByTime(RESYNC_TIMEOUT_MS * 2);

    expect(connection.getSnapshot().room).toBe(fresh);
  });

  it("oublie la salle si le serveur ne renvoie rien (délai de grâce échu)", () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    reconnect();

    vi.advanceTimersByTime(RESYNC_TIMEOUT_MS);
    expect(connection.getSnapshot().room).toBeNull();
  });

  it("sans salle, la reconnexion ne fait rien d'autre", () => {
    startConnected();
    reconnect();
    vi.advanceTimersByTime(RESYNC_TIMEOUT_MS * 2);
    expect(connection.getSnapshot()).toEqual({ connection: "connected", room: null, error: null });
  });
});

describe("accusés (D8)", () => {
  it("n'émet rien hors connexion : OFFLINE, mémorisé comme dernière erreur", async () => {
    connection.start(ME);

    await expect(connection.create()).resolves.toEqual({ ok: false, error: "OFFLINE" });
    await expect(connection.join({ code: "ABC234", role: "runner" })).resolves.toEqual({ ok: false, error: "OFFLINE" });
    await expect(connection.updateConfig({ length: "long" })).resolves.toEqual({ ok: false, error: "OFFLINE" });
    await expect(connection.leave()).resolves.toEqual({ ok: false, error: "OFFLINE" });

    expect(socket.emissions).toEqual([]);
    expect(connection.getSnapshot().error).toBe("OFFLINE");
  });

  it("create : émet avec un délai de 5 s et une config vide (jamais undefined), renvoie le code", async () => {
    startConnected();
    const result = connection.create();

    expect(socket.emissions).toHaveLength(1);
    expect(socket.emissions[0]).toMatchObject({ event: "room:create", args: [{}], timeoutMs: ACK_TIMEOUT_MS });
    socket.emissions[0].ack(null, { ok: true, data: { code: "ABC234" } });

    await expect(result).resolves.toEqual({ ok: true, data: { code: "ABC234" } });
    expect(connection.getSnapshot().error).toBeNull();
  });

  it("create : transmet la configuration demandée", async () => {
    startConnected();
    const result = connection.create({ language: "en" });
    expect(socket.emissions[0].args).toEqual([{ language: "en" }]);
    socket.emissions[0].ack(null, { ok: true, data: { code: "ABC234" } });
    await result;
  });

  it("join : renvoie le refus du serveur et le mémorise", async () => {
    startConnected();
    const result = connection.join({ code: "ABC234", role: "spectator" });

    expect(socket.emissions[0]).toMatchObject({ event: "room:join", args: [{ code: "ABC234", role: "spectator" }] });
    socket.emissions[0].ack(null, { ok: false, error: "ROOM_NOT_FOUND" });

    await expect(result).resolves.toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    expect(connection.getSnapshot().error).toBe("ROOM_NOT_FOUND");
  });

  it("accusé non reçu à temps : TIMEOUT", async () => {
    startConnected();
    const result = connection.updateConfig({ textMode: "words" });
    socket.emissions[0].ack(new Error("operation has timed out"));

    await expect(result).resolves.toEqual({ ok: false, error: "TIMEOUT" });
    expect(connection.getSnapshot().error).toBe("TIMEOUT");
  });

  it("updateConfig accepté : efface l'erreur précédente", async () => {
    startConnected();
    socket.fire("room:error", "NOT_HOST");
    const result = connection.updateConfig({ textMode: "words" });
    socket.emissions[0].ack(null, { ok: true });

    await expect(result).resolves.toEqual({ ok: true, data: undefined });
    expect(connection.getSnapshot().error).toBeNull();
  });

  it("leave : vide la salle sans attendre l'état du serveur", async () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    const result = connection.leave();
    socket.emissions[0].ack(null, { ok: true });

    await expect(result).resolves.toEqual({ ok: true, data: undefined });
    expect(connection.getSnapshot().room).toBeNull();
  });

  it("leave alors qu'un autre onglet a déjà quitté (NOT_IN_ROOM) : c'est un succès", async () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    const result = connection.leave();
    socket.emissions[0].ack(null, { ok: false, error: "NOT_IN_ROOM" });

    await expect(result).resolves.toEqual({ ok: true, data: undefined });
    expect(connection.getSnapshot().room).toBeNull();
  });

  it("leave refusé pour une autre raison : la salle est conservée", async () => {
    startConnected();
    socket.fire("room:state", roomState([ME]));
    const result = connection.leave();
    socket.emissions[0].ack(null, { ok: false, error: "INTERNAL" });

    await expect(result).resolves.toEqual({ ok: false, error: "INTERNAL" });
    expect(connection.getSnapshot().room).not.toBeNull();
  });
});
