/**
 * Gestionnaires Socket.IO de la salle (lot 2). Aucune règle métier ici : chaque événement
 * valide sa charge utile, appelle le registre, répond, puis diffuse.
 *
 * Source de vérité : le registre. La salle d'un utilisateur est `store.roomOf(user.id)`
 * (D1) ; `socket.data.roomCode` n'est qu'un cache, mis à jour pour tous les sockets de
 * l'utilisateur à la fois. L'identité vient uniquement de `socket.data.user`.
 */

import type { Socket } from "socket.io";
import type { GraceTimers } from "./graceTimers";
import {
  parseJoinPayload,
  parseRoomConfigPatch,
  RECONNECT_GRACE_MS,
  type Ack,
  type ClientToServerEvents,
  type RoomState,
  type ServerToClientEvents,
  type SocketData,
} from "./protocol";
import type { createRoomStore } from "./roomStore";
import type { RealtimeServer } from "./server";

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface RoomHandlerDeps {
  now: () => Date;
  store: ReturnType<typeof createRoomStore>;
  /** Minuteurs de grâce du serveur (D4). */
  timers: GraceTimers;
  /** Délai avant le retrait d'un participant déconnecté ; `RECONNECT_GRACE_MS` par défaut. */
  graceMs?: number;
}

type AckFailure = Extract<Ack, { ok: false }>;

/** Résultat d'un gestionnaire : la réponse à l'émetteur, puis ce qu'il faut faire après. */
interface Outcome<TSuccess extends { ok: true }> {
  reply: TSuccess | AckFailure;
  /** Exécuté après l'accusé : diffusion, sortie des rooms. */
  publish?: () => void;
}

function failure(error: AckFailure["error"]): Outcome<never> {
  return { reply: { ok: false, error } };
}

/** Message d'erreur seul : jamais l'objet complet, qui pourrait embarquer requête ou en-têtes. */
function describeError(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : "unknown error";
}

export function registerRoomHandlers(
  io: RealtimeServer,
  socket: RealtimeSocket,
  deps: RoomHandlerDeps,
): void {
  const { store, now, timers } = deps;
  const graceMs = deps.graceMs ?? RECONNECT_GRACE_MS;
  const user = socket.data.user;

  /** Tous les sockets ouverts de l'utilisateur (un par onglet). */
  const userSockets = (): RealtimeSocket[] =>
    [...io.sockets.sockets.values()].filter((s) => s.data.user.id === user.id);

  const attachUser = (code: string): void => {
    for (const s of userSockets()) {
      void s.join(code);
      s.data.roomCode = code;
    }
  };

  const detachUser = (code: string): void => {
    for (const s of userSockets()) {
      void s.leave(code);
      s.data.roomCode = null;
    }
  };

  const broadcast = (state: RoomState): void => {
    io.to(state.code).emit("room:state", state);
  };

  /**
   * Ignore l'événement si le client n'a pas fourni d'accusé. Toute exception du gestionnaire
   * devient `INTERNAL`, journalisée sans cookie ni jeton.
   */
  function respond<TSuccess extends { ok: true }>(
    ack: (res: TSuccess | AckFailure) => void,
    run: () => Outcome<TSuccess>,
  ): void {
    if (typeof ack !== "function") return;
    let outcome: Outcome<TSuccess>;
    try {
      outcome = run();
    } catch (e) {
      console.error("[realtime] handler failed:", describeError(e));
      ack({ ok: false, error: "INTERNAL" });
      return;
    }
    ack(outcome.reply);
    try {
      outcome.publish?.();
    } catch (e) {
      console.error("[realtime] broadcast failed:", describeError(e));
    }
  }

  // D2 : un socket qui se connecte reprend la place de son utilisateur, sans que le client
  // ait à le demander (rechargement, coupure réseau, nouvel onglet : SALLE-13).
  try {
    const code = store.roomOf(user.id);
    if (code) {
      attachUser(code);
      timers.cancel(user.id);
      const res = store.reconnect(user.id, code);
      if (res.ok) broadcast(res.state);
    }
  } catch (e) {
    console.error("[realtime] reattach failed:", describeError(e));
  }

  socket.on("room:create", (configInput, ack) => {
    respond(ack, () => {
      const patch = parseRoomConfigPatch(configInput);
      if (!patch) return failure("INVALID_PAYLOAD");

      const res = store.create(user, patch, now().getTime());
      if (!res.ok) return failure(res.error);

      const { state } = res;
      attachUser(state.code);
      return {
        reply: { ok: true, data: { code: state.code } },
        publish: () => broadcast(state),
      };
    });
  });

  socket.on("room:join", (payloadInput, ack) => {
    respond(ack, () => {
      const payload = parseJoinPayload(payloadInput);
      if (payload === "INVALID_PAYLOAD" || payload === "INVALID_CODE") return failure(payload);

      const res = store.join(user, payload.code, payload.role, now().getTime());
      if (!res.ok) return failure(res.error);

      const { state } = res;
      attachUser(state.code);
      timers.cancel(user.id);
      return {
        reply: { ok: true, data: { code: state.code } },
        publish: () => broadcast(state),
      };
    });
  });

  socket.on("room:updateConfig", (patchInput, ack) => {
    respond(ack, () => {
      const patch = parseRoomConfigPatch(patchInput);
      if (!patch) return failure("INVALID_PAYLOAD");

      const code = store.roomOf(user.id);
      if (!code) return failure("NOT_IN_ROOM");

      const res = store.updateConfig(user.id, code, patch);
      if (!res.ok) return failure(res.error);

      const { state } = res;
      return { reply: { ok: true }, publish: () => broadcast(state) };
    });
  });

  socket.on("room:leave", (ack) => {
    respond(ack, () => {
      const code = store.roomOf(user.id);
      if (!code) return failure("NOT_IN_ROOM");

      const res = store.leave(user.id, code);
      if (!res.ok) return failure(res.error);

      timers.cancel(user.id);
      const { state } = res;
      return {
        reply: { ok: true },
        publish: () => {
          // D3 : l'état sans le partant part à toute la salle, ses autres onglets compris,
          // puis ses sockets sortent de la room. Une salle supprimée n'a plus personne à
          // informer : pas d'état « closed ».
          if (state.status !== "closed") broadcast(state);
          detachUser(code);
        },
      };
    });
  });

  socket.on("disconnect", () => {
    try {
      const code = store.roomOf(user.id);
      if (!code) return;

      // Un autre onglet ouvert : l'utilisateur reste connecté (SALLE-13).
      if (userSockets().some((s) => s.id !== socket.id)) return;

      const res = store.disconnect(user.id, code);
      if (!res.ok) return;
      broadcast(res.state);

      timers.arm(user.id, graceMs, () => {
        try {
          const expired = store.expire(user.id, code);
          if (expired.ok && expired.state.status !== "closed") broadcast(expired.state);
        } catch (e) {
          console.error("[realtime] expiry failed:", describeError(e));
        }
      });
    } catch (e) {
      console.error("[realtime] disconnect failed:", describeError(e));
    }
  });
}
