/**
 * Gestionnaires Socket.IO de la salle (lot 2). Aucune règle métier ici : chaque événement
 * valide sa charge utile, appelle le registre, répond, puis diffuse.
 *
 * Source de vérité : le registre. La salle d'un utilisateur est `store.roomOf(user.id)`
 * (D1) ; `socket.data.roomCode` n'est qu'un cache, mis à jour pour tous les sockets de
 * l'utilisateur à la fois. L'identité vient uniquement de `socket.data.user`.
 */

import type { Socket } from "socket.io";
import type { RateLimiter } from "@/auth/rateLimit";
import type { GraceTimers } from "./graceTimers";
import {
  parseCreatePayload,
  parseRaceCommand,
  parseRaceInput,
  parseJoinPayload,
  parseJoinInvitePayload,
  parseKickPayload,
  parseRoomConfigPatch,
  RECONNECT_GRACE_MS,
  type Ack,
  type ClientToServerEvents,
  type LobbyRoom,
  type RoomState,
  type ServerToClientEvents,
  type SocketData,
} from "./protocol";
import type { createRoomStore } from "./roomStore";
import type { RealtimeServer } from "./server";
import type { UserSockets } from "./userSockets";

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
  /** Index des sockets ouverts par utilisateur. */
  sockets: UserSockets;
  /** Échecs de `room:join` par utilisateur (énumération des codes de salle). */
  joinFailures: RateLimiter;
  raceInputs: RateLimiter;
  syncRace: (code: string) => void;
  /** Liste des salles publiques (JOIN-02). */
  lobbyList: () => LobbyRoom[];
  /** Annonce un changement possible de la liste : la diffusion aux abonnés est regroupée. */
  lobbyChanged: (invalidate?: boolean) => void;
}

/** Room Socket.IO des abonnés à l'explorateur ; ne peut pas être un code de salle (6 caractères). */
export const LOBBY_ROOM = "lobby";

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
  const { store, now, timers, sockets, joinFailures } = deps;
  const graceMs = deps.graceMs ?? RECONNECT_GRACE_MS;
  const user = socket.data.user;

  /** Tous les sockets ouverts de l'utilisateur (un par onglet). */
  const userSockets = (): RealtimeSocket[] => sockets.of(user.id);

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

  /** Liste des liens, à l'hôte seulement et à tous ses onglets (SALLE-04, SALLE-08) ; jamais dans `room:state`. */
  const sendInvites = (code: string, hostId: string): void => {
    const invites = store.invites(hostId, code);
    if (!invites) return;
    for (const s of sockets.of(hostId)) s.emit("room:invites", invites);
  };

  const broadcast = (state: RoomState): void => {
    io.to(state.code).emit("room:state", state);
    deps.syncRace(state.code);
    deps.lobbyChanged();
  };

  const resumeRace = (code: string): void => {
    const snapshot = store.snapshot(code);
    deps.syncRace(code);
    if (!snapshot) return;
    for (const s of userSockets()) {
      s.emit("race:state", snapshot);
      if (snapshot.status === "results") {
        const results = store.results(code);
        if (results) s.emit("race:results", results);
      } else {
        const self = store.self(code, user.id);
        if (self) s.emit("race:self", self);
      }
    }
  };

  /**
   * D3 : l'état sans le partant part à toute la salle, ses autres onglets compris, puis ses
   * sockets sortent de la room. Si la salle est supprimée (dernier humain), personne d'autre
   * n'est à informer, mais les onglets du partant reçoivent l'état vide pour repasser à
   * « hors salle ».
   */
  const publishDeparture = (code: string, state: RoomState): void => {
    if (state.status === "closed") {
      for (const s of userSockets()) s.emit("room:state", state);
      deps.syncRace(code);
      deps.lobbyChanged();
    } else {
      broadcast(state);
      sendInvites(code, state.hostId); // le départ était peut-être celui de l'hôte (SALLE-08)
    }
    detachUser(code);
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
  // ait à le demander (rechargement, coupure réseau, nouvel onglet : ancien SALLE-13).
  try {
    const code = store.roomOf(user.id);
    if (code) {
      attachUser(code);
      timers.cancel(user.id);
      const res = store.reconnect(user.id, code);
      if (res.ok) {
        broadcast(res.state);
        resumeRace(code);
        if (res.state.hostId === user.id) sendInvites(code, user.id);
      }
    }
  } catch (e) {
    console.error("[realtime] reattach failed:", describeError(e));
  }

  socket.on("room:create", (payloadInput, ack) => {
    respond(ack, () => {
      const payload = parseCreatePayload(payloadInput);
      if (!payload) return failure("INVALID_PAYLOAD");

      const res = store.create(user, payload.config, payload.role, now().getTime());
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
      // Énumération des codes (H-5) : au-delà de la limite d'échecs, on répond `INVALID_CODE`
      // sans consulter le registre. Le protocole n'a pas de code « trop de tentatives » et
      // `INVALID_CODE` ne révèle rien sur les salles existantes.
      if (joinFailures.isLimited(user.id)) return failure("INVALID_CODE");

      const payload = parseJoinPayload(payloadInput);
      if (payload === "INVALID_CODE") joinFailures.record(user.id);
      if (payload === "INVALID_PAYLOAD" || payload === "INVALID_CODE") return failure(payload);

      const res = store.join(user, payload.code, payload.role, now().getTime());
      if (!res.ok) {
        // `ROOM_NOT_FOUND` compte comme échec, avec `INVALID_CODE`, ainsi qu'`INVITE_REQUIRED` qui
        // confirme qu'un code existe (SALLE-03, SALLE-10). `ROOM_FULL` et `ALREADY_IN_ROOM` ne
        // comptent pas, par choix : ils ne font pas oracle. Le premier exige déjà un code exact ;
        // le second ne consulte pas le registre des salles.
        if (res.error === "ROOM_NOT_FOUND" || res.error === "INVITE_REQUIRED") joinFailures.record(user.id);
        return failure(res.error);
      }

      const { state } = res;
      attachUser(state.code);
      timers.cancel(user.id);
      return {
        reply: { ok: true, data: { code: state.code } },
        publish: () => {
          broadcast(state);
          resumeRace(state.code);
        },
      };
    });
  });

  // SALLE-04 : mêmes limites d'échecs que `room:join`; le jeton, jamais journalisé, n'est que comparé par hachage.
  socket.on("room:joinInvite", (payloadInput, ack) => {
    respond(ack, () => {
      if (joinFailures.isLimited(user.id)) return failure("INVITE_INVALID");

      const payload = parseJoinInvitePayload(payloadInput);
      if (!payload) {
        joinFailures.record(user.id);
        return failure("INVALID_PAYLOAD");
      }

      const res = store.joinInvite(user, payload.token, payload.role, socket.data.ip, now().getTime());
      if (!res.ok) {
        if (res.error === "INVITE_INVALID") joinFailures.record(user.id);
        return failure(res.error);
      }

      const { state } = res;
      attachUser(state.code);
      timers.cancel(user.id);
      return {
        reply: { ok: true, data: { code: state.code } },
        publish: () => {
          broadcast(state);
          resumeRace(state.code);
          sendInvites(state.code, state.hostId); // le statut du lien vient de changer
        },
      };
    });
  });

  // SALLE-04 : hôte seulement ; le jeton en clair ne repasse qu'ici, dans l'accusé de l'hôte.
  socket.on("room:createInvite", (payloadInput, ack) => {
    respond(ack, () => {
      if (!parseRaceCommand(payloadInput)) return failure("INVALID_PAYLOAD");
      const code = store.roomOf(user.id);
      if (!code) return failure("NOT_IN_ROOM");

      const res = store.createInvite(user.id, code);
      if (!res.ok) return failure(res.error);
      return {
        reply: { ok: true, data: { id: res.id, token: res.token } },
        publish: () => sendInvites(code, user.id),
      };
    });
  });

  // SALLE-07 : l'expulsé reçoit `room:kicked`, ses onglets quittent la room Socket.IO, la salle est mise à jour.
  socket.on("room:kick", (payloadInput, ack) => {
    respond(ack, () => {
      const payload = parseKickPayload(payloadInput);
      if (!payload) return failure("INVALID_PAYLOAD");
      const code = store.roomOf(user.id);
      if (!code) return failure("NOT_IN_ROOM");

      const res = store.kick(user.id, code, payload.userId);
      if (!res.ok) return failure(res.error);

      timers.cancel(payload.userId);
      const { state } = res;
      return {
        reply: { ok: true },
        publish: () => {
          for (const s of sockets.of(payload.userId)) {
            s.emit("room:kicked");
            void s.leave(code);
            s.data.roomCode = null;
          }
          broadcast(state);
          sendInvites(code, user.id); // le lien de l'expulsé passe à « révoqué »
        },
      };
    });
  });

  // JOIN-03 : même limite d'échecs et même règle « une seule salle » que `room:join` (SALLE-06).
  socket.on("room:quickJoin", (payloadInput, ack) => {
    respond(ack, () => {
      if (joinFailures.isLimited(user.id)) return failure("INVALID_CODE");
      if (!parseRaceCommand(payloadInput)) return failure("INVALID_PAYLOAD");
      if (store.roomOf(user.id)) return failure("ALREADY_IN_ROOM");

      const code = store.quickJoinCode(user.id);
      if (code === null) return failure("NO_ROOM_AVAILABLE");

      const res = store.join(user, code, "runner", now().getTime());
      if (!res.ok) return failure(res.error);

      const { state } = res;
      attachUser(state.code);
      timers.cancel(user.id);
      return {
        reply: { ok: true, data: { code: state.code } },
        publish: () => {
          broadcast(state);
          resumeRace(state.code);
        },
      };
    });
  });

  // JOIN-02 : seules les salles publiques sont envoyées, à l'abonnement puis à chaque changement.
  socket.on("lobby:subscribe", (payloadInput, ack) => {
    respond(ack, () => {
      if (!parseRaceCommand(payloadInput)) return failure("INVALID_PAYLOAD");
      void socket.join(LOBBY_ROOM);
      return {
        reply: { ok: true },
        publish: () => {
          socket.emit("lobby:rooms", deps.lobbyList());
          // Les autres abonnés, déjà à jour, reçoivent la liste en double : acceptable, regroupé.
          deps.lobbyChanged(true);
        },
      };
    });
  });

  socket.on("lobby:unsubscribe", (payloadInput, ack) => {
    respond(ack, () => {
      if (!parseRaceCommand(payloadInput)) return failure("INVALID_PAYLOAD");
      void socket.leave(LOBBY_ROOM);
      return { reply: { ok: true } };
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

  for (const event of ["race:start", "race:abandon", "room:restart", "room:close"] as const) {
    socket.on(event, (payload, ack) => {
      respond(ack, () => {
        if (!parseRaceCommand(payload)) return failure("INVALID_PAYLOAD");
        const code = store.roomOf(user.id);
        if (!code) return failure("NOT_IN_ROOM");
        const res = event === "race:start" ? store.start(user.id, code)
          : event === "race:abandon" ? store.abandon(user.id, code)
          : store.finish(user.id, code, event === "room:close");
        if (!res.ok) return failure(res.error);
        return {
          reply: { ok: true },
          publish: () => {
            broadcast(res.state);
            if (res.state.status === "closed") {
              for (const p of res.state.participants) {
                timers.cancel(p.userId);
                for (const s of sockets.of(p.userId)) {
                  void s.leave(code);
                  s.data.roomCode = null;
                }
              }
            }
          },
        };
      });
    });
  }

  socket.on("race:input", (payloadInput) => {
    if (!deps.raceInputs.consume(user.id)) return;
    const payload = parseRaceInput(payloadInput);
    if (!payload) {
      socket.emit("room:error", "INPUT_REJECTED");
      return;
    }
    const code = store.roomOf(user.id);
    if (!code) {
      socket.emit("room:error", "RACE_NOT_RUNNING");
      return;
    }
    const res = store.input(user.id, code, payload.ops);
    if (!res.ok) {
      socket.emit("room:error", res.error);
      const self = store.self(code, user.id);
      if (self) socket.emit("race:self", self);
    }
    deps.syncRace(code);
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
        publish: () => publishDeparture(code, state),
      };
    });
  });

  socket.on("disconnect", () => {
    try {
      const code = store.roomOf(user.id);
      if (!code) return;

      // Un autre onglet ouvert : l'utilisateur reste connecté (ancien SALLE-13).
      if (userSockets().some((s) => s.id !== socket.id)) return;

      const res = store.disconnect(user.id, code);
      if (!res.ok) return;
      broadcast(res.state);

      timers.arm(user.id, graceMs, () => {
        try {
          const expired = store.expire(user.id, code);
          if (expired.ok) publishDeparture(code, expired.state);
        } catch (e) {
          console.error("[realtime] expiry failed:", describeError(e));
        }
      });
    } catch (e) {
      console.error("[realtime] disconnect failed:", describeError(e));
    }
  });
}
