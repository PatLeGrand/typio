/**
 * Store de module de la salle, côté navigateur (D5, D8, D9). Il garde l'état de connexion,
 * le dernier `RoomState` et la dernière erreur, et se lit avec `useSyncExternalStore`
 * (`useRoom`). Aucun React ici : il se teste avec un faux socket.
 *
 * Le serveur est la seule source de vérité (D1, D2) : après chaque connexion il renvoie de
 * lui-même `room:state` si l'utilisateur est déjà dans une salle. Le client n'a donc aucune
 * logique de reconnexion à une salle.
 */

import type { RoomSocket } from "./client";
import {
  type JoinPayload,
  type ParticipantRole,
  type RoomConfigPatch,
  type RoomErrorCode,
  type RoomState,
  type ServerToClientEvents,
} from "./protocol";

/** Codes d'erreur propres au client (D8), traduits comme ceux du serveur. */
export type ClientRoomErrorCode = RoomErrorCode | "OFFLINE" | "TIMEOUT" | "ROOM_CLOSED";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "offline"
  | "unauthenticated"
  /** Le serveur refuse un onglet de plus (limite de connexions par utilisateur). */
  | "tooManyConnections";

export interface RoomSnapshot {
  connection: ConnectionStatus;
  /** Salle de l'utilisateur courant, ou `null` s'il n'est dans aucune salle. */
  room: RoomState | null;
  error: ClientRoomErrorCode | null;
  race: Parameters<ServerToClientEvents["race:state"]>[0] | null;
  results: Parameters<ServerToClientEvents["race:results"]>[0] | null;
  self: Parameters<ServerToClientEvents["race:self"]>[0] | null;
  raceReceivedAt: number | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ClientRoomErrorCode };

/** Attente d'un accusé avant de conclure à un `TIMEOUT` (D8). */
export const ACK_TIMEOUT_MS = 5_000;
/** Premier délai avant de relancer une connexion refusée ; double à chaque échec (D9). */
export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 15_000;
/**
 * Après une reconnexion, le serveur renvoie l'état de la salle en quelques millisecondes.
 * S'il ne l'a pas fait au bout de ce délai, l'utilisateur n'est plus dans aucune salle
 * (délai de grâce échu) : on oublie l'ancien état plutôt que de l'afficher indéfiniment.
 */
export const RESYNC_TIMEOUT_MS = 3_000;

const UNAUTHENTICATED_MESSAGE = "UNAUTHENTICATED";
const TOO_MANY_CONNECTIONS_MESSAGE = "TOO_MANY_CONNECTIONS";

export const IDLE_SNAPSHOT: RoomSnapshot = { connection: "idle", room: null, error: null, race: null, results: null, self: null, raceReceivedAt: null };

/**
 * L'état reçu n'est valable que si l'utilisateur y figure ; sinon (il a quitté, ou un autre
 * onglet l'a fait) il n'est plus dans une salle (D3).
 */
export function roomForUser(state: RoomState, userId: string): RoomState | null {
  return state.status !== "closed" && state.participants.some((participant) => participant.userId === userId) ? state : null;
}

export interface RoomConnection {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RoomSnapshot;
  getServerSnapshot(): RoomSnapshot;
  /**
   * Connecte le socket pour cet utilisateur. Sans effet s'il est connecté ou en cours de
   * connexion ; relance la connexion si elle est tombée sans qu'une relance soit prévue
   * (session refusée puis rétablie, trop d'onglets).
   */
  start(userId: string): void;
  /** Coupe le socket et oublie la salle : déconnexion, changement d'utilisateur. */
  stop(): void;
  /** Coupe le socket s'il appartient à un autre utilisateur que `userId` (ou si `userId` est `null`). */
  syncUser(userId: string | null): void;
  create(config?: RoomConfigPatch, role?: ParticipantRole): Promise<ActionResult<{ code: string }>>;
  join(payload: JoinPayload): Promise<ActionResult<{ code: string }>>;
  updateConfig(patch: RoomConfigPatch): Promise<ActionResult>;
  startRace(): Promise<ActionResult>;
  abandonRace(): Promise<ActionResult>;
  restartRace(): Promise<ActionResult>;
  closeRoom(): Promise<ActionResult>;
  sendInput(ops: string[]): void;
  leave(): Promise<ActionResult>;
  clearError(): void;
}

export function createRoomConnection(getSocket: () => RoomSocket | null): RoomConnection {
  let snapshot: RoomSnapshot = IDLE_SNAPSHOT;
  const listeners = new Set<() => void>();

  let socket: RoomSocket | null = null;
  let userId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let resyncTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = RETRY_BASE_MS;
  let detach: (() => void) | null = null;

  function update(patch: Partial<RoomSnapshot>): void {
    const next = { ...snapshot, ...patch };
    if (next.room === null || next.room.status === "waiting" || next.room.status === "closed") {
      next.race = null;
      next.results = null;
      next.self = null;
      next.raceReceivedAt = null;
    }
    if (next.connection === snapshot.connection && next.room === snapshot.room && next.error === snapshot.error &&
      next.race === snapshot.race && next.results === snapshot.results && next.self === snapshot.self &&
      next.raceReceivedAt === snapshot.raceReceivedAt) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
    if (timer !== null) clearTimeout(timer);
    return null;
  }

  function scheduleReconnect(target: RoomSocket): void {
    retryTimer = clearTimer(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      target.connect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }

  function attach(target: RoomSocket): () => void {
    const onConnect = () => {
      retryDelay = RETRY_BASE_MS;
      retryTimer = clearTimer(retryTimer);
      if (snapshot.room !== null) {
        resyncTimer = clearTimer(resyncTimer);
        resyncTimer = setTimeout(() => {
          resyncTimer = null;
          update({ room: null });
        }, RESYNC_TIMEOUT_MS);
      }
      update({ connection: "connected" });
    };

    const onDisconnect = (reason: string) => {
      update({ connection: "offline" });
      // Socket.IO ne se reconnecte pas seul quand c'est le serveur qui a coupé.
      if (reason === "io server disconnect") scheduleReconnect(target);
    };

    const onConnectError = (error: Error) => {
      if (error.message === UNAUTHENTICATED_MESSAGE) {
        retryTimer = clearTimer(retryTimer);
        update({ connection: "unauthenticated" });
        return;
      }
      if (error.message === TOO_MANY_CONNECTIONS_MESSAGE) {
        // Pas de relance : une boucle de tentatives ne libérerait aucun onglet.
        retryTimer = clearTimer(retryTimer);
        update({ connection: "tooManyConnections" });
        return;
      }
      update({ connection: "offline" });
      // Un refus du middleware n'est pas relancé par Socket.IO (`active` est faux) : à nous de le faire.
      if (!target.active) scheduleReconnect(target);
    };

    const onState = (state: RoomState) => {
      resyncTimer = clearTimer(resyncTimer);
      // Un refus reste lisible jusqu'à la prochaine action, sauf si la salle a été fermée.
      update({
        room: userId === null ? null : roomForUser(state, userId),
        error: state.status === "closed" ? "ROOM_CLOSED" : snapshot.error,
      });
    };

    const onRace: ServerToClientEvents["race:state"] = (race) => update({ race, raceReceivedAt: Date.now() });
    const onResults: ServerToClientEvents["race:results"] = (results) => update({ results });
    const onSelf: ServerToClientEvents["race:self"] = (self) => update({ self });
    const onRoomError = (error: RoomErrorCode) => update({ error });

    target.on("connect", onConnect);
    target.on("disconnect", onDisconnect);
    target.on("connect_error", onConnectError);
    target.on("room:state", onState);
    target.on("room:error", onRoomError);
    target.on("race:state", onRace);
    target.on("race:results", onResults);
    target.on("race:self", onSelf);

    return () => {
      target.off("connect", onConnect);
      target.off("disconnect", onDisconnect);
      target.off("connect_error", onConnectError);
      target.off("room:state", onState);
      target.off("room:error", onRoomError);
      target.off("race:state", onRace);
      target.off("race:results", onResults);
      target.off("race:self", onSelf);
    };
  }

  function stop(): void {
    detach?.();
    detach = null;
    retryTimer = clearTimer(retryTimer);
    resyncTimer = clearTimer(resyncTimer);
    socket?.disconnect();
    socket = null;
    userId = null;
    retryDelay = RETRY_BASE_MS;
    update({ ...IDLE_SNAPSHOT });
  }

  function syncUser(nextUserId: string | null): void {
    if (userId !== null && userId !== nextUserId) stop();
  }

  function fail(error: ClientRoomErrorCode): { ok: false; error: ClientRoomErrorCode } {
    update({ error });
    return { ok: false, error };
  }

  /** Socket utilisable pour émettre, ou `null` : on n'émet jamais hors connexion (D8). */
  function connectedSocket(): RoomSocket | null {
    return socket !== null && socket.connected ? socket : null;
  }

  function raceCommand(event: "race:start" | "race:abandon" | "room:restart" | "room:close"): Promise<ActionResult> {
    return new Promise((resolve) => {
      update({ error: null });
      const target = connectedSocket();
      if (target === null) return resolve(fail("OFFLINE"));
      target.timeout(ACK_TIMEOUT_MS).emit(event, {}, (timedOut, response) => {
        if (timedOut) return resolve(fail("TIMEOUT"));
        if (!response.ok) return resolve(fail(response.error));
        resolve({ ok: true, data: undefined });
      });
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => IDLE_SNAPSHOT,

    stop,
    syncUser,

    start(nextUserId) {
      if (userId === nextUserId && socket !== null) {
        const dropped =
          snapshot.connection === "unauthenticated" ||
          snapshot.connection === "tooManyConnections" ||
          (snapshot.connection === "offline" && retryTimer === null);
        if (dropped && !socket.connected) {
          update({ connection: "connecting" });
          socket.connect();
        }
        return;
      }
      // Autre utilisateur dans le même onglet : la session a changé, il faut une nouvelle poignée de main.
      if (socket !== null) stop();
      const target = getSocket();
      if (target === null) return;
      socket = target;
      userId = nextUserId;
      detach = attach(target);
      update({ connection: "connecting", room: null, error: null });
      target.connect();
    },

    create(config, role = "runner") {
      return new Promise((resolve) => {
        update({ error: null });
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        // `{}` et non `undefined` : un argument `undefined` arriverait en `null` côté serveur.
        target.timeout(ACK_TIMEOUT_MS).emit("room:create", { config: config ?? {}, role }, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          resolve({ ok: true, data: response.data });
        });
      });
    },

    join(payload) {
      return new Promise((resolve) => {
        update({ error: null });
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:join", payload, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          resolve({ ok: true, data: response.data });
        });
      });
    },

    startRace: () => raceCommand("race:start"),
    abandonRace: () => raceCommand("race:abandon"),
    restartRace: () => raceCommand("room:restart"),
    closeRoom: () => raceCommand("room:close"),
    sendInput(ops) {
      connectedSocket()?.emit("race:input", { ops });
    },

    updateConfig(patch) {
      return new Promise((resolve) => {
        update({ error: null });
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:updateConfig", patch, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          resolve({ ok: true, data: undefined });
        });
      });
    },

    leave() {
      return new Promise((resolve) => {
        update({ error: null });
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:leave", (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          // Déjà hors de la salle (un autre onglet est parti avant) : le but est atteint.
          if (!response.ok && response.error !== "NOT_IN_ROOM") return resolve(fail(response.error));
          resyncTimer = clearTimer(resyncTimer);
          update({ room: null });
          resolve({ ok: true, data: undefined });
        });
      });
    },

    clearError() {
      update({ error: null });
    },
  };
}
