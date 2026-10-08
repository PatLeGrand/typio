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
  type RoomConfigPatch,
  type RoomErrorCode,
  type RoomState,
} from "./protocol";

/** Codes d'erreur propres au client (D8), traduits comme ceux du serveur. */
export type ClientRoomErrorCode = RoomErrorCode | "OFFLINE" | "TIMEOUT";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "offline" | "unauthenticated";

export interface RoomSnapshot {
  connection: ConnectionStatus;
  /** Salle de l'utilisateur courant, ou `null` s'il n'est dans aucune salle. */
  room: RoomState | null;
  error: ClientRoomErrorCode | null;
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

export const IDLE_SNAPSHOT: RoomSnapshot = { connection: "idle", room: null, error: null };

/**
 * L'état reçu n'est valable que si l'utilisateur y figure ; sinon (il a quitté, ou un autre
 * onglet l'a fait) il n'est plus dans une salle (D3).
 */
export function roomForUser(state: RoomState, userId: string): RoomState | null {
  return state.participants.some((participant) => participant.userId === userId) ? state : null;
}

export interface RoomConnection {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RoomSnapshot;
  getServerSnapshot(): RoomSnapshot;
  /** Connecte le socket pour cet utilisateur ; sans effet s'il l'est déjà. */
  start(userId: string): void;
  create(config?: RoomConfigPatch): Promise<ActionResult<{ code: string }>>;
  join(payload: JoinPayload): Promise<ActionResult<{ code: string }>>;
  updateConfig(patch: RoomConfigPatch): Promise<ActionResult>;
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
    if (next.connection === snapshot.connection && next.room === snapshot.room && next.error === snapshot.error) {
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
      update({ connection: "offline" });
      // Un refus du middleware n'est pas relancé par Socket.IO (`active` est faux) : à nous de le faire.
      if (!target.active) scheduleReconnect(target);
    };

    const onState = (state: RoomState) => {
      resyncTimer = clearTimer(resyncTimer);
      update({ room: userId === null ? null : roomForUser(state, userId), error: null });
    };

    const onRoomError = (error: RoomErrorCode) => update({ error });

    target.on("connect", onConnect);
    target.on("disconnect", onDisconnect);
    target.on("connect_error", onConnectError);
    target.on("room:state", onState);
    target.on("room:error", onRoomError);

    return () => {
      target.off("connect", onConnect);
      target.off("disconnect", onDisconnect);
      target.off("connect_error", onConnectError);
      target.off("room:state", onState);
      target.off("room:error", onRoomError);
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

  function fail(error: ClientRoomErrorCode): { ok: false; error: ClientRoomErrorCode } {
    update({ error });
    return { ok: false, error };
  }

  /** Socket utilisable pour émettre, ou `null` : on n'émet jamais hors connexion (D8). */
  function connectedSocket(): RoomSocket | null {
    return socket !== null && socket.connected ? socket : null;
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

    start(nextUserId) {
      if (userId === nextUserId && socket !== null) return;
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

    create(config) {
      return new Promise((resolve) => {
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        // `{}` et non `undefined` : un argument `undefined` arriverait en `null` côté serveur.
        target.timeout(ACK_TIMEOUT_MS).emit("room:create", config ?? {}, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          update({ error: null });
          resolve({ ok: true, data: response.data });
        });
      });
    },

    join(payload) {
      return new Promise((resolve) => {
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:join", payload, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          update({ error: null });
          resolve({ ok: true, data: response.data });
        });
      });
    },

    updateConfig(patch) {
      return new Promise((resolve) => {
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:updateConfig", patch, (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          if (!response.ok) return resolve(fail(response.error));
          update({ error: null });
          resolve({ ok: true, data: undefined });
        });
      });
    },

    leave() {
      return new Promise((resolve) => {
        const target = connectedSocket();
        if (target === null) return resolve(fail("OFFLINE"));
        target.timeout(ACK_TIMEOUT_MS).emit("room:leave", (timedOut, response) => {
          if (timedOut) return resolve(fail("TIMEOUT"));
          // Déjà hors de la salle (un autre onglet est parti avant) : le but est atteint.
          if (!response.ok && response.error !== "NOT_IN_ROOM") return resolve(fail(response.error));
          resyncTimer = clearTimer(resyncTimer);
          update({ room: null, error: null });
          resolve({ ok: true, data: undefined });
        });
      });
    },

    clearError() {
      update({ error: null });
    },
  };
}
